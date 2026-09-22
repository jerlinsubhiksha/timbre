import os
import numpy as np
import soundfile as sf

def generate_dummy_dataset(base_dir='dataset', num_samples=100, duration=2.0, sr=16000):
    """
    Generates a dummy dataset of sine waves to test the PyTorch pipeline.
    Replace these with actual Real and Fake human audio later.
    """
    real_dir = os.path.join(base_dir, 'real')
    fake_dir = os.path.join(base_dir, 'fake')
    
    os.makedirs(real_dir, exist_ok=True)
    os.makedirs(fake_dir, exist_ok=True)
    
    t = np.linspace(0, duration, int(sr * duration), False)
    
    print(f"Generating {num_samples} Real (Human) audio files...")
    for i in range(num_samples):
        # Human: Low frequency sine wave + noise
        audio = 0.5 * np.sin(2 * np.pi * 300 * t) + np.random.normal(0, 0.05, len(t))
        sf.write(os.path.join(real_dir, f'human_{i}.wav'), audio, sr)
        
    print(f"Generating {num_samples} Fake (AI) audio files...")
    for i in range(num_samples):
        # AI: High frequency sine wave + noise (simulating artificial artifacts)
        audio = 0.5 * np.sin(2 * np.pi * 1000 * t) + np.random.normal(0, 0.1, len(t))
        sf.write(os.path.join(fake_dir, f'ai_{i}.wav'), audio, sr)
        
    print(f"Dataset generated at {base_dir}/")
    print("WARNING: This is dummy data for testing the pipeline.")
    print("To train a REAL deepfake detector, replace the .wav files in these folders with your actual dataset!")

if __name__ == '__main__':
    generate_dummy_dataset()
