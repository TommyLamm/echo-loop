import os
import zipfile

def pack_dist():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(base_dir, 'dist')
    zip_path = os.path.join(base_dir, 'game.zip')

    if not os.path.exists(dist_dir):
        raise FileNotFoundError(f"Dist directory not found at {dist_dir}")

    if os.path.exists(zip_path):
        os.remove(zip_path)

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                abs_path = os.path.join(root, file)
                # 根目錄下的相對路徑
                rel_path = os.path.relpath(abs_path, dist_dir)
                zf.write(abs_path, rel_path)
                print(f"Added to zip: {rel_path}")

    size = os.path.getsize(zip_path)
    print(f"Successfully generated game.zip, size: {size} bytes ({size / 1024:.2f} KB)")

if __name__ == '__main__':
    pack_dist()
