
import numpy as np
from typing import Optional, List, Dict
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.core import Printer, PrinterStatusEnum
from app.models.filament import AmsSlot

# --- Color Math Helpers ---

def _hex_to_rgb(hex_color: str) -> np.ndarray:
    """
    Convert hex string to RGB numpy array (0-1 range).
    Handles 6 char 'RRGGBB' and 8 char 'RRGGBBAA' (strips Alpha).
    """
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 8:
        hex_color = hex_color[:6]
    
    return np.array([int(hex_color[i:i+2], 16) for i in (0, 2, 4)]) / 255.0

def _rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """
    Convert sRGB (0-1) to CIE Lab.
    Uses D65 illuminant and 2 degree observer.
    """
    # 1. Linearize sRGB
    mask = rgb > 0.04045
    rgb[mask] = ((rgb[mask] + 0.055) / 1.055) ** 2.4
    rgb[~mask] = rgb[~mask] / 12.92
    
    # 2. sRGB to XYZ
    # Matrix for D65
    M = np.array([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041]
    ])
    XYZ = rgb @ M.T
    
    # 3. XYZ to Lab
    # Reference white D65
    Xn, Yn, Zn = 0.95047, 1.00000, 1.08883
    XYZ = XYZ / np.array([Xn, Yn, Zn])
    
    mask = XYZ > 0.008856
    XYZ[mask] = XYZ[mask] ** (1/3)
    XYZ[~mask] = (7.787 * XYZ[~mask]) + (16/116)
    
    L = 116 * XYZ[1] - 16
    a = 500 * (XYZ[0] - XYZ[1])
    b = 200 * (XYZ[1] - XYZ[2])
    
    return np.array([L, a, b])

def calculate_delta_e(hex_a: str, hex_b: str) -> float:
    """
    Calculate CIEDE2000 color difference between two hex strings.
    Strips alpha channel if present.
    """
    try:
        rgb_a = _hex_to_rgb(hex_a)
        rgb_b = _hex_to_rgb(hex_b)
        
        lab_a = _rgb_to_lab(rgb_a)
        lab_b = _rgb_to_lab(rgb_b)
        
        # CIEDE2000 Implementation
        L1, a1, b1 = lab_a
        L2, a2, b2 = lab_b
        
        kL = 1
        kC = 1
        kH = 1
        
        C1 = np.sqrt(a1**2 + b1**2)
        C2 = np.sqrt(a2**2 + b2**2)
        C_bar = (C1 + C2) / 2
        
        G = 0.5 * (1 - np.sqrt(C_bar**7 / (C_bar**7 + 25**7)))
        
        a1_prime = (1 + G) * a1
        a2_prime = (1 + G) * a2
        
        C1_prime = np.sqrt(a1_prime**2 + b1**2)
        C2_prime = np.sqrt(a2_prime**2 + b2**2)
        
        h1_prime = np.degrees(np.arctan2(b1, a1_prime)) % 360
        h2_prime = np.degrees(np.arctan2(b2, a2_prime)) % 360
        
        if C1_prime == 0: h1_prime = 0
        if C2_prime == 0: h2_prime = 0
        
        # Delta L, C, H
        dL_prime = L2 - L1
        dC_prime = C2_prime - C1_prime
        
        dh_prime = 0
        if C1_prime * C2_prime != 0:
            diff = h2_prime - h1_prime
            if abs(diff) <= 180:
                dh_prime = diff
            elif diff > 180:
                dh_prime = diff - 360
            elif diff < -180:
                dh_prime = diff + 360
                
        dH_prime = 2 * np.sqrt(C1_prime * C2_prime) * np.sin(np.radians(dh_prime / 2))
        
        # Mean values
        L_bar_prime = (L1 + L2) / 2
        C_bar_prime = (C1_prime + C2_prime) / 2
        
        h_bar_prime = h1_prime + h2_prime
        if C1_prime * C2_prime != 0:
            if abs(h1_prime - h2_prime) <= 180:
                h_bar_prime = h_bar_prime / 2
            elif abs(h1_prime - h2_prime) > 180 and (h1_prime + h2_prime) < 360:
                h_bar_prime = (h_bar_prime + 360) / 2
            elif abs(h1_prime - h2_prime) > 180 and (h1_prime + h2_prime) >= 360:
                h_bar_prime = (h_bar_prime - 360) / 2
        else:
             h_bar_prime = h1_prime + h2_prime # One is 0
        
        T = 1 - 0.17 * np.cos(np.radians(h_bar_prime - 30)) + \
            0.24 * np.cos(np.radians(2 * h_bar_prime)) + \
            0.32 * np.cos(np.radians(3 * h_bar_prime + 6)) - \
            0.20 * np.cos(np.radians(4 * h_bar_prime - 63))
            
        dTheta = 30 * np.exp(-((h_bar_prime - 275) / 25)**2)
        Rc = 2 * np.sqrt(C_bar_prime**7 / (C_bar_prime**7 + 25**7))
        SL = 1 + (0.015 * (L_bar_prime - 50)**2) / np.sqrt(20 + (L_bar_prime - 50)**2)
        SC = 1 + 0.045 * C_bar_prime
        SH = 1 + 0.015 * C_bar_prime * T
        RT = -np.sin(np.radians(2 * dTheta)) * Rc
        
        delta_e = np.sqrt(
            (dL_prime / (kL * SL))**2 +
            (dC_prime / (kC * SC))**2 +
            (dH_prime / (kH * SH))**2 +
            RT * (dC_prime / (kC * SC)) * (dH_prime / (kH * SH))
        )
        
        return float(delta_e)
        
    except Exception as e:
        print(f"Error calculating Delta E for {hex_a} and {hex_b}: {e}")
        return 100.0 # Return high diff on error

# --- Printer Matching Logic ---

async def find_best_printer_for_job(
    session: AsyncSession,
    required_colors: list[str],
    required_material: str
) -> Optional[dict]:
    """
    Find the best idle printer with matching material and all required colors.
    Returns dictionary with printer serial and AMS mapping, or None.
    
    Return Format:
    {
        "printer_serial": str,
        "ams_mapping": List[int] # Maps required_colors[i] -> slot_index
    }
    """
    
    # 1. Query all IDLE printers with their AMS slots
    from sqlalchemy.orm import selectinload
    
    statement = select(Printer).where(Printer.current_status == PrinterStatusEnum.IDLE).options(selectinload(Printer.ams_slots))
    result = await session.exec(statement)
    printers = result.all()
    
    for printer in printers:
        if not printer.ams_slots:
            continue
            
        # Filter slots by material first
        valid_slots = [
            slot for slot in printer.ams_slots 
            if slot.tray_type and slot.tray_type.lower() == required_material.lower() 
            and slot.tray_color
        ]
        
        if len(valid_slots) < len(required_colors):
            continue
            
        # Try to find a match for EACH required color
        # We need to map each req_color index to a slot_index
        # One slot can potentially satisfy multiple requirements of the same color? 
        # Requirement says: "A printer is valid ONLY IF it has all required_colors loaded"
        # Usually for multi-color prints, you need distinct slots if they are different colors.
        # If they are the SAME color, you might use one slot or multiple. 
        # For simplicity and likely intent: specific slots for specific AMS mappings.
        # But if I need 2x Red and I have 1 Red slot, can I use it? Usually yes.
        # However, to be safe and avoid "running out", one might map to distinct slots.
        # But the prompt says "ams_mapping: List[int] # e.g., [0, 3]".
        # Let's assume strict distinct slots best for safety, OR allow reuse. 
        # Given "Brain matching orders to printers", if I have a 4-color print 
        # with Red, Blue, Green, Yellow, I need 4 slots.
        # If I have Red, Red, I probably need 2 slots OR 1 slot is fine.
        # Let's try to find a Best Match.
        # Greedy matching: for each req_color, find best available slot.
        # To avoid using the same slot for different colors (impossible) -> obviously checked by color diff.
        # To avoid using the same slot for same color -> maybe necessary? 
        # Let's assume REUSE IS ALLOWED for same color requirements unless specified otherwise. 
        # Actually, simpler: For each requirement, find a slot with Delta E < 5.
        
        ams_mapping = []
        full_match_found = True
        
        for req_color in required_colors:
            best_slot_for_this_color = None
            min_delta = 5.0
            
            for slot in valid_slots:
                # Calculate Delta E
                d_e = calculate_delta_e(req_color, slot.tray_color)
                if d_e < min_delta:
                    min_delta = d_e
                    best_slot_for_this_color = slot
            
            if best_slot_for_this_color:
                # We found a slot for this color
                # Note: `slot_index` is what we need. 
                # Be careful: `ams_slots` has `ams_index` (0-3) and `slot_index` (0-3). 
                # Bambu usually maps AMS 0: 0-3, AMS 1: 4-7 etc.
                # But `AmsSlot` model has `ams_index` and `slot_index`.
                # The return format example says `ams_mapping: List[int]`.
                # If we have multiple AMS units, we need a flat index? 
                # Usually simple setup is 1 AMS (0-3).
                # Let's explicitly use the `AmsSlot.id` or consistent mapping?
                # The prompt example: "ams_mapping: List[int]".
                # The `AmsSlotRead` in `printer.py` had `ams_index` and `slot_index`.
                # Let's assume flat index 0-15 (4 AMS * 4 Slots) logic: index = ams_index * 4 + slot_index.
                
                flat_index = best_slot_for_this_color.ams_index * 4 + best_slot_for_this_color.slot_index
                ams_mapping.append(flat_index)
            else:
                full_match_found = False
                break
        
        if full_match_found:
            return {
                "printer_serial": printer.serial,
                "ams_mapping": ams_mapping
            }
            
    return None

