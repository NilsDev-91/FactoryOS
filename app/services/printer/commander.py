
import asyncio
import ssl
import json
import logging
import aioftp
from typing import List, Optional
# Assuming usage of gmqtt based on typical async stacks or we can implement a simple client here.
# However, for stateless command execution, we can use gmqtt direct connect.
# The user prompt specifically asked for "Logic: Connect, publish, disconnect".
from gmqtt import Client as MQTTClient

logger = logging.getLogger("PrinterCommander")

class PrinterCommander:
    def __init__(self):
        pass

    async def upload_file(self, ip: str, access_code: str, local_path: str, target_filename: str) -> None:
        """
        Uploads a file to the printer via FTPS (Implicit TLS).
        Uploads to /sdcard/factoryos/.
        """
        # --- SIMULATION MODE ---
        if ip == "127.0.0.1":
            logger.info(f"SIMULATION: Mocking Upload to {ip}")
            await asyncio.sleep(1) # Simulate network delay
            return
        # -----------------------

        logger.info(f"Uploading {local_path} to {ip} as {target_filename}...")
        
        # Configure SSL for Implicit TLS (Port 990)
        # Bambu requires TLSv1.2 (usually) and we must ignore cert errors
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        # Force TLS 1.2 if needed, though default usually negotiates down. 
        # But some Bambu FW is picky.
        # context.minimum_version = ssl.TLSVersion.TLSv1_2 
        
        try:
            async with aioftp.Client.context(
                host=ip,
                port=990,
                user="bblp",
                password=access_code,
                ssl=context,
                socket_timeout=10,
                path_timeout=10
            ) as client:
                
                # Check/Create directory
                target_dir = "/sdcard/factoryos"
                try:
                    await client.make_directory(target_dir)
                except aioftp.StatusCodeError:
                    # Likely exists
                    pass
                
                # Change directory
                await client.change_directory(target_dir)
                
                # Upload
                await client.upload(local_path, target_filename)
                logger.info(f"Upload to {ip} complete.")
                
        except Exception as e:
            logger.error(f"FTPS Upload Failed: {e}")
            raise e

    async def start_print_job(
        self, 
        ip: str, 
        serial: str, 
        access_code: str, 
        filename: str, 
        ams_mapping: List[int]
    ) -> None:
        """
        Connects to MQTT, sends print command, and disconnects.
        """
        # --- SIMULATION MODE ---
        if ip == "127.0.0.1":
            logger.info(f"SIMULATION: Mocking MQTT Command to {ip}")
            await asyncio.sleep(0.5)
            return
        # -----------------------

        logger.info(f"Sending Print Command to {serial} ({ip})...")
        
        client = MQTTClient(client_id=f"commander_{serial}")
        
        # Bambu MQTT Auth
        client.set_auth_credentials("bblp", access_code)
        
        # SSL Context for MQTT (8883)
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        
        connected_event = asyncio.Event()
        
        def on_connect(client, flags, rc, properties):
            logger.debug("MQTT Connected")
            connected_event.set()
            
        client.on_connect = on_connect
        
        try:
            await client.connect(ip, 8883, ssl=context)
            await _async_wait(connected_event) # Wait for connection
            
            topic = f"device/{serial}/request"
            
            payload = {
                "print": {
                    "sequence_id": "2000",
                    "command": "project_file",
                    "param": f"Metadata/plate_1.gcode",
                    "url": f"file:///sdcard/factoryos/{filename}",
                    "use_ams": True,
                    "ams_mapping": ams_mapping
                }
            }
            
            client.publish(topic, json.dumps(payload))
            logger.info("Print payload published.")
            
            # Brief wait to ensure send
            await asyncio.sleep(0.5)
            
            await client.disconnect()
            
        except Exception as e:
            logger.error(f"MQTT Command Failed: {e}")
            raise e

# Helper for waiting
async def _async_wait(event: asyncio.Event, timeout=10):
    try:
        await asyncio.wait_for(event.wait(), timeout)
    except asyncio.TimeoutError:
         raise TimeoutError("MQTT Connection Timeout")

