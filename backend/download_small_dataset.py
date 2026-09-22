import os
import shutil
import kagglehub

def prepare_small_dataset():
    print("Downloading small dataset...")
    # This dataset is significantly smaller
    try:
        path = kagglehub.dataset_download("birdy654/deep-voice-deepfake-voice-recognition")
        print("Dataset downloaded to:", path)
    except Exception as e:
        print("Failed to download dataset:", e)
        return

    real_target_dir = os.path.join('dataset', 'real')
    fake_target_dir = os.path.join('dataset', 'fake')
    
    # Clear old dummy data
    if os.path.exists('dataset'):
        shutil.rmtree('dataset')
    os.makedirs(real_target_dir, exist_ok=True)
    os.makedirs(fake_target_dir, exist_ok=True)

    # Let's search the path for 'real' and 'fake' folders, or just gather files
    real_count = 0
    fake_count = 0
    max_files = 200

    for root, dirs, files in os.walk(path):
        for f in files:
            if f.endswith('.wav') or f.endswith('.flac'):
                src = os.path.join(root, f)
                # Simple heuristic based on common folder names
                if 'real' in root.lower() or 'bonafide' in root.lower():
                    if real_count < max_files:
                        shutil.copy2(src, os.path.join(real_target_dir, f))
                        real_count += 1
                elif 'fake' in root.lower() or 'spoof' in root.lower() or 'synthetic' in root.lower():
                    if fake_count < max_files:
                        shutil.copy2(src, os.path.join(fake_target_dir, f))
                        fake_count += 1
                
                if real_count >= max_files and fake_count >= max_files:
                    break

    print(f"Copied {real_count} real files and {fake_count} fake files.")

if __name__ == '__main__':
    prepare_small_dataset()
