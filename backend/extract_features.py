import sys
import json
import librosa

path = sys.argv[1]
y, sr = librosa.load(path, sr=16000)

features = {
    "tempo": librosa.beat.tempo(y=y, sr=sr)[0],
    "rms": float(librosa.feature.rms(y=y).mean()),
    "mfcc": librosa.feature.mfcc(y=y, sr=sr).mean(axis=1).tolist(),
    "spectral_centroid": float(librosa.feature.spectral_centroid(y=y, sr=sr).mean()),
    "zero_crossing_rate": float(librosa.feature.zero_crossing_rate(y).mean())
}

print(json.dumps(features))
