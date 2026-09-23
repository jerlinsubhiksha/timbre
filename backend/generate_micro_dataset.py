import os
import soundfile as sf
import numpy as np
from datasets import load_dataset
from gtts import gTTS
import tempfile
import librosa

def generate_datasets():
    real_dir = os.path.join('dataset', 'real')
    fake_dir = os.path.join('dataset', 'fake')
    
    os.makedirs(real_dir, exist_ok=True)
    os.makedirs(fake_dir, exist_ok=True)
    
    print("--------------------------------------------------")
    print("STEP 1: Downloading Real Human Call Data")
    print("--------------------------------------------------")
    # PolyAI/minds14 contains recordings of real people making phone queries
    try:
        print("Fetching from HuggingFace (only downloading 50 audio clips)...")
        minds = load_dataset("PolyAI/minds14", name="en-US", split="train[:50]")
        
        for i, item in enumerate(minds):
            audio_array = item['audio']['array']
            sr = item['audio']['sampling_rate']
            # Save to wav
            filepath = os.path.join(real_dir, f"real_human_{i}.wav")
            sf.write(filepath, audio_array, sr)
            
        print(f"Successfully generated 50 Real Human audio files in {real_dir}")
    except Exception as e:
        print(f"Failed to fetch real data: {e}")

    print("--------------------------------------------------")
    print("STEP 2: Generating Fake AI Voice Data")
    print("--------------------------------------------------")
    sentences = [
        "Hello, my account is locked and I need help.",
        "Could you please tell me my current bank balance?",
        "I would like to transfer some money to another account.",
        "What are the interest rates for a new mortgage?",
        "Can I speak to a customer service representative?",
        "I lost my credit card and need to cancel it immediately.",
        "How do I update my billing address?",
        "Is there a branch near me that is open on weekends?",
        "I didn't authorize this recent transaction.",
        "Thank you for your help, have a great day!"
    ]
    
    try:
        count = 0
        for i in range(5): # Generate 50 total (10 sentences * 5 variations/speeds)
            for j, text in enumerate(sentences):
                # We use different domains to slightly alter the TTS generation (simulating different AI models)
                tld = ['com', 'co.uk', 'com.au', 'co.in', 'ie'][i] 
                tts = gTTS(text=text, lang='en', tld=tld, slow=(j%2==0))
                
                # Save to a temporary mp3 file
                temp_mp3 = os.path.join(fake_dir, f"temp_{count}.mp3")
                tts.save(temp_mp3)
                
                # Convert mp3 to wav using librosa
                y, sr = librosa.load(temp_mp3, sr=16000)
                filepath = os.path.join(fake_dir, f"fake_ai_{count}.wav")
                sf.write(filepath, y, sr)
                
                # Clean up mp3
                os.remove(temp_mp3)
                count += 1
                
        print(f"Successfully generated 50 Fake AI audio files in {fake_dir}")
    except Exception as e:
        print(f"Failed to generate fake data: {e}")

if __name__ == '__main__':
    generate_datasets()
