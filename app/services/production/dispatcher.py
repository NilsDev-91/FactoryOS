
import asyncio
import logging
from typing import Optional
from sqlmodel import select
from sqlalchemy.orm import selectinload

from app.core.database import async_session_maker
from app.models.core import Job, Printer, Product, JobStatusEnum, PrinterStatusEnum, OrderStatusEnum
from app.models.order import Order
from app.services.logic.filament_manager import find_best_printer_for_job
from app.services.printer.commander import PrinterCommander

logger = logging.getLogger("ProductionDispatcher")

class ProductionDispatcher:
    def __init__(self):
        self.commander = PrinterCommander()
        self.is_running = False

    async def start(self):
        """Starts the infinite dispatch loop."""
        self.is_running = True
        logger.info("Production Dispatcher Started.")
        while self.is_running:
            try:
                await self.run_cycle()
            except Exception as e:
                logger.error(f"Error in Dispatch Loop: {e}", exc_info=True)
            
            await asyncio.sleep(10)

    async def stop(self):
        """Stops the loop."""
        self.is_running = False
        logger.info("Production Dispatcher Stopping...")

    async def run_cycle(self):
        """Single iteration of the dispatch logic."""
        async with async_session_maker() as session:
            # 1. Fetch PENDING Jobs
            # We assume Job.gcode_path links to Product.file_path_3mf
            statement = select(Job).where(Job.status == JobStatusEnum.PENDING)
            result = await session.exec(statement)
            pending_jobs = result.all()
            
            if not pending_jobs:
                return

            logger.info(f"Found {len(pending_jobs)} PENDING jobs.")

            for job in pending_jobs:
                # 2. Get Product Requirements
                # We need to find the product that matches this gcode
                prod_stmt = select(Product).where(Product.file_path_3mf == job.gcode_path)
                prod_result = await session.exec(prod_stmt)
                product = prod_result.first()
                
                if not product:
                    logger.warning(f"Job {job.id}: Product not found for gcode {job.gcode_path}. Skipping.")
                    continue

                # Prepare requirements
                required_material = product.required_filament_type
                # Handle color: List[str] required. Product has single Optional[str]
                required_colors = []
                if product.required_filament_color:
                    required_colors.append(product.required_filament_color)
                
                # if no requirements, assume generic? 
                # FilamentManager logic might skip empty colors if we passed empty list.
                # But let's pass what we have.
                if not required_material:
                     logger.warning(f"Job {job.id}: Product has no material defined. Skipping.")
                     continue
                
                # 3. Find Printer
                match = await find_best_printer_for_job(session, required_colors, required_material)
                
                if match:
                    printer_serial = match["printer_serial"]
                    ams_mapping = match["ams_mapping"]
                    
                    logger.info(f"Job {job.id}: Matched to Printer {printer_serial} (AMS: {ams_mapping})")
                    
                    # 4. Lock & Execute
                    await self.assign_and_execute_job(session, job, printer_serial, ams_mapping)
                else:
                    logger.debug(f"Job {job.id}: No matching IDLE printer found.")

    async def assign_and_execute_job(self, session, job: Job, printer_serial: str, ams_mapping: list):
        """
        Locks the job/printer and triggers execution.
        """
        try:
            # --- LOCKING ---
            # Refetch objects to ensure fresh state/lock inside transaction if needed
            # (Assuming we are in the same session context)
            
            printer = await session.get(Printer, printer_serial)
            if not printer or printer.current_status != PrinterStatusEnum.IDLE:
                 logger.warning(f"Printer {printer_serial} no longer IDLE. Aborting assignment.")
                 return

            # Update statuses
            job.assigned_printer_serial = printer_serial
            job.status = JobStatusEnum.UPLOADING
            
            printer.current_status = PrinterStatusEnum.PRINTING
            
            # Also update Order status?
            # Usually Job PENDING -> UPLOADING implies Order is progressing.
            if job.order_id:
                order = await session.get(Order, job.order_id)
                if order:
                    order.status = OrderStatusEnum.PRINTING  # Or equivalent
                    session.add(order)
            
            session.add(job)
            session.add(printer)
            await session.commit()
            
            # --- EXECUTION ---
            # We use a separate try/except block for the actual comms to handle revert
            try:
                # Fetch printer connection details
                # (Assuming printer object has IP/Access Code from DB)
                ip = printer.ip_address
                access_code = printer.access_code
                
                if not ip or not access_code:
                     raise ValueError("Printer IP or Access Code missing")

                # Upload
                # Target filename: ensure unique? or just basename
                # commander.upload_file uses basename usually or we specify.
                # job.gcode_path is the "local path" on server?
                # Product.file_path_3mf is likely local.
                # Assuming job.gcode_path is absolute or relative to cwd.
                import os
                filename = os.path.basename(job.gcode_path)
                
                await self.commander.upload_file(
                    ip=ip, 
                    access_code=access_code, 
                    local_path=job.gcode_path, 
                    target_filename=filename
                )
                
                # Start Print
                await self.commander.start_print_job(
                    ip=ip,
                    serial=printer_serial,
                    access_code=access_code,
                    filename=filename,
                    ams_mapping=ams_mapping
                )
                
                # Success Update
                # Since we committed UPLOADING/PRINTING earlier, we just update Job to PRINTING?
                # Actually, Job status UPLOADING is fine during upload. 
                # Now shift to PRINTING (or ensure it stays PRINTING if we mapped it so).
                # But wait, we set Printer to PRINTING. Job to UPLOADING.
                # Now set Job to PRINTING.
                
                job.status = JobStatusEnum.PRINTING
                session.add(job)
                await session.commit()
                logger.info(f"Job {job.id}: Execution started successfully on {printer_serial}.")
                
            except Exception as exec_err:
                logger.error(f"Job {job.id}: Execution Failed - {exec_err}")
                
                # --- REVERT ---
                # We need to revert Printer to IDLE (unless it's actually broken?)
                # And Job to FAILED (or PENDING to retry?)
                # User config: "Set Job status to FAILED ... and log error"
                
                # Refresh objects
                await session.refresh(job)
                await session.refresh(printer)
                
                printer.current_status = PrinterStatusEnum.IDLE
                job.status = JobStatusEnum.FAILED
                job.error_message = str(exec_err)
                job.assigned_printer_serial = None # Unassign?
                
                session.add(printer)
                session.add(job)
                await session.commit()

        except Exception as e:
            logger.error(f"Error during assignment transaction for Job {job.id}: {e}")
            # If DB commit failed, connection issues etc.
