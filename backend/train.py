import torch
import torch.nn as nn
import torch.optim as optim
import os
from model import VoxGuardCNN
from dataset_loader import get_dataloaders

def train_model(data_dir='dataset', epochs=10, batch_size=32, lr=0.001):
    # Set device to GPU if available
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Training on device: {device}")

    train_loader, test_loader = get_dataloaders(data_dir, batch_size=batch_size)
    
    if train_loader is None:
        print("Error: Dataset not found or empty. Please run prepare_dataset.py first!")
        return

    model = VoxGuardCNN().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)

    print("Starting Training Loop...")
    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        
        for i, (inputs, labels) in enumerate(train_loader):
            inputs, labels = inputs.to(device), labels.to(device)
            
            # Zero gradients
            optimizer.zero_grad()
            
            # Forward pass
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            
            # Backward pass & optimize
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            
        print(f"Epoch {epoch+1}/{epochs} - Loss: {running_loss/len(train_loader):.4f}")

    print("Training Complete. Evaluating on Test Set...")
    
    # Evaluation
    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for inputs, labels in test_loader:
            inputs, labels = inputs.to(device), labels.to(device)
            outputs = model(inputs)
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
            
    accuracy = 100 * correct / total
    print(f"Final Test Accuracy: {accuracy:.2f}%")

    # Save model weights
    os.makedirs('weights', exist_ok=True)
    torch.save(model.state_dict(), 'weights/voxguard_model.pth')
    print("Model saved to weights/voxguard_model.pth")

if __name__ == '__main__':
    train_model()
