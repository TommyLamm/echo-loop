import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_echo_loop_cover():
    width = 800
    height = 500
    
    # 創建主畫布
    img = Image.new('RGB', (width, height), (10, 14, 23))
    draw = ImageDraw.Draw(img)
    
    # 1. 繪製深藍/暗青色漸層底景
    for y in range(height):
        ratio = y / height
        r = int(10 + 8 * (1 - ratio))
        g = int(14 + 18 * ratio)
        b = int(23 + 45 * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
        
    # 2. 透視量子網格
    grid_color = (0, 180, 240, 40)
    grid_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(grid_img)
    
    # 水平透視線
    horizon_y = 200
    for i in range(1, 16):
        py = horizon_y + int((height - horizon_y) * (i / 15.0) ** 1.8)
        alpha = int(30 + 120 * (i / 15.0))
        gdraw.line([(0, py), (width, py)], fill=(0, 240, 255, alpha), width=1)
        
    # 縱向輻射透視線
    vanish_x = width // 2
    for x in range(-400, width + 500, 50):
        gdraw.line([(vanish_x, horizon_y), (x, height)], fill=(0, 240, 255, 45), width=1)
        
    # 3. 巨型量子時鐘光環 (在背景)
    clock_cx = width // 2 + 100
    clock_cy = 230
    clock_radius = 160
    
    for r_offset in range(-6, 7, 2):
        r = clock_radius + r_offset
        gdraw.ellipse([clock_cx - r, clock_cy - r, clock_cx + r, clock_cy + r],
                      outline=(0, 240, 255, max(10, 90 - abs(r_offset) * 15)), width=2)
                      
    # 刻度線
    for angle_deg in range(0, 360, 30):
        rad = math.radians(angle_deg)
        x1 = clock_cx + math.cos(rad) * (clock_radius - 12)
        y1 = clock_cy + math.sin(rad) * (clock_radius - 12)
        x2 = clock_cx + math.cos(rad) * (clock_radius + 4)
        y2 = clock_cy + math.sin(rad) * (clock_radius + 4)
        color = (255, 230, 0, 220) if angle_deg % 90 == 0 else (0, 240, 255, 160)
        width_line = 3 if angle_deg % 90 == 0 else 1
        gdraw.line([(x1, y1), (x2, y2)], fill=color, width=width_line)
        
    # 時鐘發光掃描指針
    for p_offset in range(12):
        rad = math.radians(290 - p_offset * 4)
        x2 = clock_cx + math.cos(rad) * (clock_radius - 15)
        y2 = clock_cy + math.sin(rad) * (clock_radius - 15)
        alpha = int(180 * (1 - p_offset / 12))
        gdraw.line([(clock_cx, clock_cy), (x2, y2)], fill=(255, 70, 120, alpha), width=2)

    # 4. 致命雷射光束 (穿越畫面)
    laser_y = 340
    for offset in range(-4, 5):
        alpha = max(10, 200 - abs(offset) * 45)
        gdraw.line([(0, laser_y + offset), (width, laser_y + offset - 40)], fill=(255, 20, 80, alpha), width=1)
    gdraw.line([(0, laser_y), (width, laser_y - 40)], fill=(255, 255, 255, 255), width=2)

    # 5. 特工與多重殘影 (Ghost 2, Ghost 1, Current Agent)
    agents = [
        # (x, y, scale, angle, color_rgba, is_current)
        (220, 390, 0.9, -15, (160, 32, 240, 140), False),  # Ghost 2: 紫色
        (330, 360, 1.05, -25, (0, 240, 255, 190), False),  # Ghost 1: 青藍
        (460, 320, 1.2, -35, (255, 230, 50, 255), True),   # Main: 金黃白
    ]
    
    for ax, ay, scale, angle_deg, color, is_main in agents:
        rad = math.radians(angle_deg)
        # 繪製特工幾何身體 (尖銳三角形戰術特工造型)
        # 計算局部座標旋轉
        pts = [
            (24 * scale, 0),
            (-16 * scale, -14 * scale),
            (-8 * scale, 0),
            (-16 * scale, 14 * scale),
        ]
        rot_pts = []
        for px, py in pts:
            rx = ax + px * math.cos(rad) - py * math.sin(rad)
            ry = ay + px * math.sin(rad) + py * math.cos(rad)
            rot_pts.append((rx, ry))
            
        # 發光光環
        for halo_r in [26 * scale, 20 * scale]:
            gdraw.ellipse([ax - halo_r, ay - halo_r, ax + halo_r, ay + halo_r],
                          outline=color if not is_main else (255, 230, 80, 140), width=2)
                          
        # 實體三角形
        gdraw.polygon(rot_pts, fill=color)
        if is_main:
            gdraw.polygon(rot_pts, outline=(255, 255, 255, 255))
            # 槍口光束
            nose_x = rot_pts[0][0]
            nose_y = rot_pts[0][1]
            laser_dir_x = math.cos(rad)
            laser_dir_y = math.sin(rad)
            gdraw.line([(nose_x, nose_y), (nose_x + laser_dir_x * 80, nose_y + laser_dir_y * 80)],
                       fill=(255, 255, 200, 180), width=2)
                       
        # 殘影量子掃描線 (橫紋)
        if not is_main:
            for sy in range(int(ay - 20 * scale), int(ay + 20 * scale), 4):
                gdraw.line([(ax - 22 * scale, sy), (ax + 22 * scale, sy)], fill=(255, 255, 255, 80), width=1)
                
    # 6. 量子數據核心 (Cube)
    core_x, core_y = 660, 240
    for glow_r in range(40, 10, -5):
        gdraw.ellipse([core_x - glow_r, core_y - glow_r, core_x + glow_r, core_y + glow_r],
                      fill=(0, 240, 255, int(15 * (1 - glow_r / 40))))
    core_pts = [
        (core_x, core_y - 25),
        (core_x + 22, core_y - 12),
        (core_x + 22, core_y + 15),
        (core_x, core_y + 28),
        (core_x - 22, core_y + 15),
        (core_x - 22, core_y - 12),
    ]
    gdraw.polygon(core_pts, fill=(0, 240, 255, 220), outline=(255, 255, 255, 255))
    gdraw.line([(core_x, core_y - 25), (core_x, core_y + 28)], fill=(255, 255, 255, 200), width=2)
    gdraw.line([(core_x - 22, core_y - 12), (core_x, core_y + 2)], fill=(255, 255, 255, 200), width=2)
    gdraw.line([(core_x + 22, core_y - 12), (core_x, core_y + 2)], fill=(255, 255, 255, 200), width=2)

    # 合併圖層
    img = Image.alpha_composite(img.convert('RGBA'), grid_img).convert('RGB')
    draw = ImageDraw.Draw(img)

    # 7. 文字排版 (賽博字體效果)
    try:
        # 嘗試載入系統無襯線或等寬字體
        font_large = ImageFont.truetype("arialbd.ttf", 52)
        font_sub = ImageFont.truetype("arialbd.ttf", 22)
        font_zh = ImageFont.truetype("msyhbd.ttc", 30)
        font_code = ImageFont.truetype("consola.ttf", 16)
    except:
        font_large = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_zh = ImageFont.load_default()
        font_code = ImageFont.load_default()

    # 頂部裝飾條
    draw.rectangle([0, 0, width, 26], fill=(5, 8, 14))
    draw.text((20, 5), "SYSTEM: QUANTUM PARADOX ENGAGED // TIME COLLAPSE: 12.00s", font=font_code, fill=(0, 240, 255))
    draw.text((650, 5), "[STATUS: RECORDING]", font=font_code, fill=(255, 230, 0))

    # 標題發光陰影
    title_text = "ECHO LOOP"
    tx, ty = 40, 75
    for ox, oy in [(-2, 0), (2, 0), (0, -2), (0, 2), (-3, -3), (3, 3)]:
        draw.text((tx + ox, ty + oy), title_text, font=font_large, fill=(0, 180, 240))
    draw.text((tx, ty), title_text, font=font_large, fill=(255, 255, 255))

    sub_title = "TIME PARADOX // 殘影特工：時間迴圈"
    draw.text((tx + 4, ty + 62), sub_title, font=font_zh, fill=(0, 240, 255))

    # 標語與小字
    desc_text = "12 SECONDS TO BREAK CAUSALITY. COOPERATE WITH YOUR PAST."
    draw.text((tx + 4, ty + 105), desc_text, font=font_code, fill=(200, 230, 255))

    # 底部 HUD
    draw.rectangle([0, height - 32, width, height], fill=(5, 8, 14))
    draw.text((20, height - 24), "GHOST-1: PEDAL LOCK | GHOST-2: LASER DECOY | AGENT: EXTRACTION", font=font_code, fill=(160, 200, 220))
    draw.text((680, height - 24), "PLAYROOM CERTIFIED", font=font_code, fill=(0, 240, 255))

    # 邊框光條
    draw.rectangle([0, 0, width - 1, height - 1], outline=(0, 240, 255), width=2)
    draw.line([(0, height - 32), (width, height - 32)], fill=(0, 240, 255), width=1)
    draw.line([(0, 26), (width, 26)], fill=(0, 240, 255), width=1)

    return img

if __name__ == '__main__':
    cover = create_echo_loop_cover()
    cover.save("F:/Desktop/Games/echo-loop/cover.png", "PNG")
    cover.save("F:/Desktop/Games/echo-loop/public/cover.png", "PNG")
    print("Successfully generated cover.png for echo-loop (800x500)")
