import sys
import json
from faster_whisper import WhisperModel

def transcribe(audio_path):
    # Using medium.en as requested for high accuracy
    model_size = "medium.en"
    
    # Run on CPU with int8 quantization (good for Windows without CUDA setup)
    # This is the safest default for Windows CPU.
    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    segments, info = model.transcribe(audio_path, beam_size=5, word_timestamps=True)

    result = {
        "segments": [],
        "words": []
    }

    for segment in segments:
        result["segments"].append({
            "start": segment.start,
            "end": segment.end,
            "text": segment.text
        })
        
        if segment.words:
            for word in segment.words:
                result["words"].append({
                    "word": word.word.strip(),
                    "start": word.start,
                    "end": word.end
                })
    
    print(json.dumps(result))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <audio_path>")
        sys.exit(1)
    transcribe(sys.argv[1])
