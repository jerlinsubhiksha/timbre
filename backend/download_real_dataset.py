import os
import shutil
import kagglehub

def prepare_real_dataset(max_files_per_class=500):
    print("Downloading ASVspoof 2019 dataset from Kaggle (this may take a while)...")
    path = kagglehub.dataset_download("awsaf49/asvpoof-2019-dataset")
    print("Dataset downloaded to:", path)
    
    # Locate protocol file and flac directory
    protocol_file = None
    flac_dir = None
    
    for root, dirs, files in os.walk(path):
        for f in files:
            if f == 'ASVspoof2019.LA.cm.train.trn.txt':
                protocol_file = os.path.join(root, f)
        
        if 'flac' in dirs and 'ASVspoof2019_LA_train' in root:
            flac_dir = os.path.join(root, 'flac')

    if not protocol_file or not flac_dir:
        print("Could not find the protocol file or flac directory in the downloaded dataset.")
        return

    print(f"Found protocol file: {protocol_file}")
    print(f"Found flac dir: {flac_dir}")
    
    real_target_dir = os.path.join('dataset', 'real')
    fake_target_dir = os.path.join('dataset', 'fake')
    
    # Clear old dummy data
    if os.path.exists('dataset'):
        shutil.rmtree('dataset')
    os.makedirs(real_target_dir, exist_ok=True)
    os.makedirs(fake_target_dir, exist_ok=True)
    
    real_count = 0
    fake_count = 0
    
    print(f"Copying {max_files_per_class} Real and {max_files_per_class} Fake files...")
    
    with open(protocol_file, 'r') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 5: continue
            
            filename = parts[1] + '.flac'
            label = parts[4] # 'bonafide' or 'spoof'
            
            src_path = os.path.join(flac_dir, filename)
            if not os.path.exists(src_path):
                continue
                
            if label == 'bonafide' and real_count < max_files_per_class:
                shutil.copy2(src_path, os.path.join(real_target_dir, filename))
                real_count += 1
            elif label == 'spoof' and fake_count < max_files_per_class:
                shutil.copy2(src_path, os.path.join(fake_target_dir, filename))
                fake_count += 1
                
            if real_count >= max_files_per_class and fake_count >= max_files_per_class:
                break
                
    print(f"Success! Prepared {real_count} real files and {fake_count} fake files.")
    print("You can now run 'python train.py' to train on real data!")

if __name__ == '__main__':
    prepare_real_dataset()
