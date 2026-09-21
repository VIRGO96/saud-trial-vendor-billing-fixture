import hashlib
import os
import pytest

def test_samples_sha256_integrity():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    samples_dir = os.path.join(base_dir, 'samples')
    sums_file = os.path.join(samples_dir, 'SHA256SUMS')
    
    assert os.path.exists(sums_file), f"SHA256SUMS not found at {sums_file}"
    
    with open(sums_file, 'r', encoding='utf-8') as f:
        lines = [l.strip() for l in f if l.strip()]
    
    assert len(lines) == 4, f"Expected 4 sample files in SHA256SUMS, got {len(lines)}"
    
    for line in lines:
        expected_hash, filename = line.split('  ')
        file_path = os.path.join(samples_dir, filename)
        assert os.path.exists(file_path), f"Sample file missing: {file_path}"
        with open(file_path, 'rb') as fp:
            content = fp.read()
            actual_hash = hashlib.sha256(content).hexdigest()
        assert actual_hash == expected_hash, f"Hash mismatch for sample file: {filename}"
