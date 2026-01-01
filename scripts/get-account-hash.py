#!/usr/bin/env python3
import hashlib

# Your public key from the PEM file
public_key_hex = "0463fc89757f974d8d08d8f61ffe805108e2bfc938234d841fd8101e4a08d6e25765a5d0c605bab83aefe6e4130d15be246f32b1575053156c5c3696d4ab08482f"

# Remove the '04' prefix (uncompressed key indicator) and take the rest
# For Casper ED25519, we need to hash the public key
public_key_bytes = bytes.fromhex(public_key_hex)

# Casper account hash = blake2b hash of the public key
account_hash = hashlib.blake2b(public_key_bytes, digest_size=32).hexdigest()

print(f"Public Key: {public_key_hex}")
print(f"Account Hash: account-hash-{account_hash}")
print(f"\nUse this to get testnet CSPR:")
print(f"https://testnet.cspr.live/tools/faucet")
print(f"\nPaste: account-hash-{account_hash}")
