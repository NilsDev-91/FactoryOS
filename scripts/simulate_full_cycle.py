
import asyncio
import sys
import os
sys.path.append(os.getcwd())
from app.core.database import async_session_maker
from app.models.core import Printer, Job, Product, PrinterStatusEnum, JobStatusEnum, OrderStatusEnum
from app.models.filament import AmsSlot
from app.models.order import Order, OrderItem
from datetime import datetime
from sqlalchemy import text # Fix for truncate if needed, or simple delete

async def run_simulation():
    print("🚀 STARTING FACTORY SIMULATION...")
    async with async_session_maker() as session:
        # CLEANUP OLD MOCKS
        print("🧹 Cleaning up old mocks...")
        # (Simplified cleanup logic for brevity, assuming standard DB constraints handle cascades or manual cleanup)
        
        # 1. Mock Printer
        print("Creating Mock Printer (SIM-001)...")
        # Try to fetch existing to update or delete
        existing_p = await session.get(Printer, "SIM-001")
        if existing_p:
            await session.delete(existing_p) # Cascade should handle slots? Or manual.
            await session.commit()
            
        printer = Printer(serial="SIM-001", name="Simulation P1S", ip_address="127.0.0.1", access_code="123", type="P1S", current_status=PrinterStatusEnum.IDLE)
        session.add(printer)
        
        # AMS Slot (Red PLA)
        # Note: AmsSlots might need cleanup if not cascaded.
        # Assuming fresh insert works.
        ams_slot = AmsSlot(printer_id="SIM-001", ams_index=0, slot_index=0, tray_color="FF0000FF", tray_type="PLA", remaining_percent=100)
        session.add(ams_slot)
        
        # 2. Mock Product (Needs Red PLA)
        print("Creating Mock Product (Cube-Red)...")
        # Delete existing
        existing_prod = await session.exec(text("SELECT id FROM products WHERE sku = 'CUBE-RED'"))
        # We'll just upsert or ignore error. Simple insert.
        # Let's ensure uniqueness logic or just try/except.
        # Cleanest:
        from sqlmodel import select
        res = await session.exec(select(Product).where(Product.sku == "CUBE-RED"))
        curr = res.first()
        if curr:
            await session.delete(curr)
        
        product = Product(sku="CUBE-RED", name="Test Cube", file_path_3mf="test_cube.gcode", required_filament_type="PLA", required_filament_color="#FF0000")
        session.add(product)
        
        # 3. Mock Order & Job
        print("Creating Mock Order & Job...")
        order = Order(
            ebay_order_id="TEST-ORD-001",
            buyer_username="sim_user",
            total_price=99.99,
            currency="USD",
            status=OrderStatusEnum.OPEN
        )
        session.add(order)
        await session.commit()
        await session.refresh(order)
        
        item = OrderItem(
            order_id=order.id, 
            sku="CUBE-RED", 
            title="Test Cube", 
            quantity=1
        )
        session.add(item)
        job = Job(order_id=order.id, gcode_path="test_cube.gcode", status=JobStatusEnum.PENDING)
        session.add(job)
        await session.commit()
        await session.refresh(job)
        
        print(f"✅ Job {job.id} created (PENDING). Waiting for Dispatcher...")

    # WAIT LOOP
    for i in range(20):
        print(f"⏳ Tick {i+1}/20...")
        await asyncio.sleep(1)
        async with async_session_maker() as session:
            refreshed_job = await session.get(Job, job.id)
            # Check for UPLOADING or PRINTING (Success) or FAILED
            if refreshed_job.status in [JobStatusEnum.UPLOADING, JobStatusEnum.PRINTING]:
                print(f"🎉 SUCCESS! Job picked up! Status: {refreshed_job.status}")
                print(f"🖨️ Assigned Printer: {refreshed_job.assigned_printer_serial}")
                return
            if refreshed_job.status == JobStatusEnum.FAILED:
                print(f"❌ FAILED! Job status set to FAILED. Error: {refreshed_job.error_message}")
                sys.exit(1)

    print("❌ TIMEOUT: Job is still PENDING after 20 seconds.")
    sys.exit(1)

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_simulation())
