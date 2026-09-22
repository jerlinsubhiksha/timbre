import os
import shutil
import kagglehub
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from train import train_model

def setup_datasets():
    MAX_FILES = 2000
    
    real_target_dir = os.path.join('dataset', 'real')
    fake_target_dir = os.path.join('dataset', 'fake')
    
    if os.path.exists('dataset'):
        shutil.rmtree('dataset')
    os.makedirs(real_target_dir, exist_ok=True)
    os.makedirs(fake_target_dir, exist_ok=True)

    print("--------------------------------------------------")
    print("STEP 1: Downloading LJSpeech (Real Audio)")
    print("--------------------------------------------------")
    try:
        real_path = kagglehub.dataset_download("keithito/lj-speech-dataset")
        print(f"LJSpeech downloaded to: {real_path}")
        real_count = 0
        for root, _, files in os.walk(real_path):
            for f in files:
                if f.endswith('.wav') and real_count < MAX_FILES:
                    shutil.copy2(os.path.join(root, f), os.path.join(real_target_dir, f))
                    real_count += 1
                if real_count >= MAX_FILES:
                    break
            if real_count >= MAX_FILES:
                break
        print(f"Successfully copied {real_count} REAL files.")
    except Exception as e:
        print(f"Error downloading LJSpeech: {e}")

    print("--------------------------------------------------")
    print("STEP 2: Downloading WaveFake (AI Audio) [27 GB]")
    print("--------------------------------------------------")
    try:
        fake_path = kagglehub.dataset_download("walimuhammadahmad/fakeaudio")
        print(f"WaveFake downloaded to: {fake_path}")
        fake_count = 0
        for root, _, files in os.walk(fake_path):
            for f in files:
                if f.endswith('.wav') and fake_count < MAX_FILES:
                    shutil.copy2(os.path.join(root, f), os.path.join(fake_target_dir, f))
                    fake_count += 1
                if fake_count >= MAX_FILES:
                    break
            if fake_count >= MAX_FILES:
                break
        print(f"Successfully copied {fake_count} FAKE files.")
    except Exception as e:
        print(f"Error downloading WaveFake: {e}")

    print("--------------------------------------------------")
    print("STEP 3: Starting PyTorch Training Loop")
    print("--------------------------------------------------")
    try:
        train_model()
    except Exception as e:
        print(f"Error during training: {e}")

if __name__ == '__main__':
    setup_datasets()
