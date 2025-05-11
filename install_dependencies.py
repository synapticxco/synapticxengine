import subprocess
import sys
import os

def ensure_pip():
    try:
        # First try to ensure pip is available
        subprocess.check_call([sys.executable, '-m', 'ensurepip', '--default-pip'])
        print("Successfully ensured pip is available")
    except subprocess.CalledProcessError as e:
        print(f"Error ensuring pip: {e}")
        sys.exit(1)

def install_packages():
    requirements_file = os.path.join('backend', 'requirements.txt')
    try:
        # Install required packages
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', requirements_file])
        print("Successfully installed dependencies")
    except subprocess.CalledProcessError as e:
        print(f"Error installing dependencies: {e}")
        sys.exit(1)

if __name__ == '__main__':
    ensure_pip()
    install_packages()