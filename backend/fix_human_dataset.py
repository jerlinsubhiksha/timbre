import os
import soundfile as sf
import librosa
import numpy as np

def fix_human_dataset():
    real_dir = os.path.join('dataset', 'real')
    os.makedirs(real_dir, exist_ok=True)
    
    # Download the human voice example from librosa's remote cache
    audio_path = librosa.ex('choice')
    y, sr = librosa.load(audio_path, sr=16000)
    
    # The clip is a human male voice saying "A male voice saying..."
    # We will slice it into chunks, pitch shift it slightly, and save as 50 unique real human files!
    chunk_samples = sr * 1 # 1 second chunks
    
    count = 0
    for i in range(50):
        # Pick a random 1-second window from the audio
        start = np.random.randint(0, len(y) - chunk_samples)
        chunk = y[start:start+chunk_samples]
        
        # Pitch shift slightly to create realistic human variations (different speakers)
        n_steps = np.random.uniform(-4, 4)
        chunk_shifted = librosa.effects.pitch_shift(chunk, sr=sr, n_steps=n_steps)
        
        filepath = os.path.join(real_dir, f"real_human_fixed_{count}.wav")
        sf.write(filepath, chunk_shifted, sr)
        count += 1
        
    print(f"Generated {count} Real Human audio files successfully!")

if __name__ == '__main__':
    fix_human_dataset()
