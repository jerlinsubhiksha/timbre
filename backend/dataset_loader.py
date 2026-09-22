import os
import torch
from torch.utils.data import Dataset, DataLoader
import librosa
import numpy as np

class AudioDataset(Dataset):
    def __init__(self, data_dir, is_train=True, max_len=128):
        self.data_dir = data_dir
        self.is_train = is_train
        self.max_len = max_len
        self.files = []
        self.labels = []
        
        # Labels: 0 for HUMAN (Real), 1 for AI (Fake)
        real_dir = os.path.join(data_dir, 'real')
        fake_dir = os.path.join(data_dir, 'fake')
        
        self._load_files(real_dir, 0)
        self._load_files(fake_dir, 1)

    def _load_files(self, directory, label):
        if not os.path.exists(directory):
            print(f"Warning: Directory {directory} does not exist.")
            return
            
        for file in os.listdir(directory):
            if file.endswith('.wav'):
                self.files.append(os.path.join(directory, file))
                self.labels.append(label)

    def __len__(self):
        return len(self.files)

    def extract_features(self, file_path):
        # Load audio file (resample to 16kHz for consistency)
        y, sr = librosa.load(file_path, sr=16000)
        
        # Generate Mel Spectrogram
        mel_spectrogram = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, fmax=8000)
        log_mel_spectrogram = librosa.power_to_db(mel_spectrogram, ref=np.max)
        
        # Padding or truncating to max_len
        if log_mel_spectrogram.shape[1] < self.max_len:
            pad_width = self.max_len - log_mel_spectrogram.shape[1]
            log_mel_spectrogram = np.pad(log_mel_spectrogram, pad_width=((0, 0), (0, pad_width)), mode='constant')
        else:
            log_mel_spectrogram = log_mel_spectrogram[:, :self.max_len]
            
        # Add channel dimension (1 channel for grayscale image)
        return torch.tensor(log_mel_spectrogram, dtype=torch.float32).unsqueeze(0)

    def __getitem__(self, idx):
        file_path = self.files[idx]
        label = self.labels[idx]
        
        features = self.extract_features(file_path)
        return features, torch.tensor(label, dtype=torch.long)

def get_dataloaders(data_dir, batch_size=32, split_ratio=0.8):
    full_dataset = AudioDataset(data_dir)
    
    if len(full_dataset) == 0:
        return None, None
        
    train_size = int(split_ratio * len(full_dataset))
    test_size = len(full_dataset) - train_size
    
    train_dataset, test_dataset = torch.utils.data.random_split(full_dataset, [train_size, test_size])
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)
    
    return train_loader, test_loader
