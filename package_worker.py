import shutil
import os

def package_worker():
    source_dir = "rris_bulk"
    output_filename = "public/rris_bulk_worker"
    
    if not os.path.exists("public"):
        os.makedirs("public")
        
    print(f"Packaging {source_dir} into {output_filename}.zip...")
    
    # Create zip file - using the base_dir to include the folder itself
    shutil.make_archive(output_filename, 'zip', root_dir='.', base_dir=source_dir)
    
    print("Package created successfully in public/ directory.")

if __name__ == "__main__":
    package_worker()
