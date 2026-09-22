import torch
import torch.nn as nn
import torch.nn.functional as F

class VoxGuardCNN(nn.Module):
    def __init__(self):
        super(VoxGuardCNN, self).__init__()
        
        # Input shape: (Batch, 1, 128, 128)
        self.conv1 = nn.Conv2d(1, 16, kernel_size=3, stride=1, padding=1)
        self.pool = nn.MaxPool2d(kernel_size=2, stride=2, padding=0)
        self.conv2 = nn.Conv2d(16, 32, kernel_size=3, stride=1, padding=1)
        self.conv3 = nn.Conv2d(32, 64, kernel_size=3, stride=1, padding=1)
        
        # After 3 max pools of 2x2, a 128x128 image becomes 16x16
        self.fc1 = nn.Linear(64 * 16 * 16, 512)
        self.dropout = nn.Dropout(0.5)
        self.fc2 = nn.Linear(512, 2) # 2 Classes: 0 (Human), 1 (AI)

    def forward(self, x):
        # Layer 1
        x = self.pool(F.relu(self.conv1(x)))
        # Layer 2
        x = self.pool(F.relu(self.conv2(x)))
        # Layer 3
        x = self.pool(F.relu(self.conv3(x)))
        
        # Flatten
        x = x.view(-1, 64 * 16 * 16)
        
        # Fully Connected
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.fc2(x)
        
        return x
