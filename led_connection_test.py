"""Simple connectivity check for NovaStar-style LED processors."""

import socket
import sys
from typing import Tuple


PORT: int = 5200
TIMEOUT_SECONDS: float = 3.0


def prompt_for_ip() -> str:
    """Prompt the user for an IP address and perform basic validation."""
    ip_address = input("Enter processor IP address (e.g., 192.168.0.100): ").strip()
    if not ip_address:
        print("FAILURE: No IP address provided.")
        sys.exit(1)
    return ip_address


def try_connect(address: Tuple[str, int]) -> bool:
    """Attempt a TCP connection to the provided address."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(TIMEOUT_SECONDS)
    try:
        sock.connect(address)
        return True
    except (socket.timeout, OSError):
        return False
    finally:
        sock.close()


def main() -> None:
    ip_address = prompt_for_ip()
    target = (ip_address, PORT)

    if try_connect(target):
        print("SUCCESS: Connection established!")
    else:
        print("FAILURE: Could not connect.")


if __name__ == "__main__":
    main()
