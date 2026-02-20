"""
Audio Analysis API for CodedSwitch
Uses RMVPE for pitch detection and HuBERT for audio features.

Features:
- Pitch Correction (Auto-Tune)
- Melody Extraction (Vocals → MIDI)
- Karaoke Scoring
- Emotion Detection
- Audio Classification
"""

import os
import sys
import tempfile
import uuid
import json
import numpy as np
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

# Add RVC to path for model imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)
CORS(app)

# Lazy-loaded models
_rmvpe_model = None
_hubert_model = None
_device = None

def get_device():
    """Get CUDA device if available."""
    global _device
    if _device is None:
        import torch
        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return _device

def get_rmvpe():
    """Lazy load RMVPE pitch detection model."""
    global _rmvpe_model
    if _rmvpe_model is None:
        import torch
        from infer.lib.rmvpe import RMVPE
        
        model_path = os.path.join(os.path.dirname(__file__), "assets", "rmvpe", "rmvpe.pt")
        if not os.path.exists(model_path):
            # Try alternate location
            model_path = os.path.join(os.path.dirname(__file__), "assets", "hubert", "rmvpe.pt")
        
        if os.path.exists(model_path):
            device = get_device()
            use_half = device.type == "cuda"
            _rmvpe_model = RMVPE(model_path, is_half=use_half, device=device)
        else:
            raise FileNotFoundError(f"RMVPE model not found at {model_path}")
    return _rmvpe_model

def load_audio(file_path, sr=16000):
    """Load audio file and resample to target sample rate."""
    import librosa
    audio, _ = librosa.load(file_path, sr=sr, mono=True)
    return audio

def save_audio(audio, file_path, sr=44100):
    """Save audio to file."""
    import soundfile as sf
    sf.write(file_path, audio, sr)

# Musical scales for pitch correction
SCALES = {
    'C_major': [0, 2, 4, 5, 7, 9, 11],
    'C_minor': [0, 2, 3, 5, 7, 8, 10],
    'chromatic': list(range(12)),
}

def hz_to_midi(hz):
    """Convert frequency in Hz to MIDI note number."""
    if hz <= 0:
        return 0
    return 69 + 12 * np.log2(hz / 440.0)

def midi_to_hz(midi):
    """Convert MIDI note number to frequency in Hz."""
    return 440.0 * (2 ** ((midi - 69) / 12.0))

def snap_to_scale(midi_note, scale='C_major', root=0):
    """Snap a MIDI note to the nearest note in a scale."""
    if midi_note <= 0:
        return midi_note
    
    scale_intervals = SCALES.get(scale, SCALES['chromatic'])
    note_in_octave = int(round(midi_note)) % 12
    octave = int(round(midi_note)) // 12
    
    # Find nearest scale degree
    min_dist = 12
    nearest = note_in_octave
    for interval in scale_intervals:
        scale_note = (root + interval) % 12
        dist = min(abs(note_in_octave - scale_note), 12 - abs(note_in_octave - scale_note))
        if dist < min_dist:
            min_dist = dist
            nearest = scale_note
    
    return octave * 12 + nearest

@app.route('/health', methods=['GET'])
def health():
    """Health check."""
    import torch
    return jsonify({
        'status': 'ok',
        'gpu': torch.cuda.is_available(),
        'device': str(get_device())
    })

@app.route('/extract-pitch', methods=['POST'])
def extract_pitch():
    """
    Extract pitch (F0) from audio using RMVPE.
    
    Request: multipart/form-data with 'audio' file
    Response: JSON with pitch data
    """
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        hop_length = int(request.form.get('hop_length', 160))
        
        # Save to temp file
        input_path = os.path.join(tempfile.gettempdir(), f'pitch_input_{uuid.uuid4().hex}.wav')
        audio_file.save(input_path)
        
        # Load audio
        audio = load_audio(input_path, sr=16000)
        
        # Extract pitch using RMVPE
        rmvpe = get_rmvpe()
        f0 = rmvpe.infer_from_audio(audio, thred=0.03)
        
        # Convert to list for JSON
        f0_list = f0.tolist() if hasattr(f0, 'tolist') else list(f0)
        
        # Calculate time axis
        times = [i * hop_length / 16000 for i in range(len(f0_list))]
        
        # Clean up
        try:
            os.remove(input_path)
        except:
            pass
        
        return jsonify({
            'success': True,
            'pitch_hz': f0_list,
            'times': times,
            'hop_length': hop_length,
            'sample_rate': 16000
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/pitch-correct', methods=['POST'])
def pitch_correct():
    """
    Apply pitch correction (auto-tune) to audio.
    
    Request: multipart/form-data
        - audio: Audio file
        - scale: Scale name (C_major, C_minor, chromatic)
        - root: Root note (0-11, where 0=C)
        - correction_strength: 0.0-1.0 (1.0 = full snap)
    
    Response: Corrected audio file
    """
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        scale = request.form.get('scale', 'C_major')
        root = int(request.form.get('root', 0))
        strength = float(request.form.get('correction_strength', 0.8))
        
        # Save input
        input_path = os.path.join(tempfile.gettempdir(), f'autotune_input_{uuid.uuid4().hex}.wav')
        output_path = os.path.join(tempfile.gettempdir(), f'autotune_output_{uuid.uuid4().hex}.wav')
        audio_file.save(input_path)
        
        # Load audio at original sample rate
        import librosa
        import soundfile as sf
        
        audio, sr = librosa.load(input_path, sr=None, mono=True)
        
        # Extract pitch
        audio_16k = librosa.resample(audio, orig_sr=sr, target_sr=16000)
        rmvpe = get_rmvpe()
        f0 = rmvpe.infer_from_audio(audio_16k, thred=0.03)
        
        # Calculate target pitches (snapped to scale)
        target_f0 = []
        for freq in f0:
            if freq > 0:
                midi = hz_to_midi(freq)
                target_midi = snap_to_scale(midi, scale, root)
                # Blend between original and target based on strength
                blended_midi = midi + (target_midi - midi) * strength
                target_f0.append(midi_to_hz(blended_midi))
            else:
                target_f0.append(0)
        
        target_f0 = np.array(target_f0)
        
        # Apply pitch shift using librosa
        # Calculate pitch shift ratio for each frame
        pitch_shift_semitones = []
        for orig, target in zip(f0, target_f0):
            if orig > 0 and target > 0:
                shift = 12 * np.log2(target / orig)
                pitch_shift_semitones.append(shift)
            else:
                pitch_shift_semitones.append(0)
        
        # For simplicity, apply average pitch shift (full frame-by-frame would need PSOLA)
        avg_shift = np.mean([s for s in pitch_shift_semitones if abs(s) < 12])
        if not np.isnan(avg_shift) and abs(avg_shift) > 0.01:
            corrected = librosa.effects.pitch_shift(audio, sr=sr, n_steps=avg_shift)
        else:
            corrected = audio
        
        # Save output
        sf.write(output_path, corrected, sr)
        
        # Clean up input
        try:
            os.remove(input_path)
        except:
            pass
        
        return send_file(output_path, mimetype='audio/wav', as_attachment=True, download_name='pitch_corrected.wav')
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/extract-melody', methods=['POST'])
def extract_melody():
    """
    Extract melody from vocals as MIDI notes.
    
    Request: multipart/form-data with 'audio' file
    Response: JSON with MIDI note data
    """
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        min_note_duration = float(request.form.get('min_note_duration', 0.1))  # seconds
        
        # Save to temp file
        input_path = os.path.join(tempfile.gettempdir(), f'melody_input_{uuid.uuid4().hex}.wav')
        audio_file.save(input_path)
        
        # Load audio
        audio = load_audio(input_path, sr=16000)
        
        # Extract pitch
        rmvpe = get_rmvpe()
        f0 = rmvpe.infer_from_audio(audio, thred=0.03)
        
        # Convert F0 to MIDI notes
        hop_time = 160 / 16000  # ~10ms per frame
        
        notes = []
        current_note = None
        current_start = 0
        
        for i, freq in enumerate(f0):
            time = i * hop_time
            
            if freq > 0:
                midi = int(round(hz_to_midi(freq)))
                
                if current_note is None:
                    # Start new note
                    current_note = midi
                    current_start = time
                elif abs(midi - current_note) > 1:
                    # Note changed - save previous and start new
                    duration = time - current_start
                    if duration >= min_note_duration:
                        notes.append({
                            'midi': current_note,
                            'note': midi_to_note_name(current_note),
                            'start': round(current_start, 3),
                            'duration': round(duration, 3),
                            'velocity': 100
                        })
                    current_note = midi
                    current_start = time
            else:
                # Silence - end current note
                if current_note is not None:
                    duration = time - current_start
                    if duration >= min_note_duration:
                        notes.append({
                            'midi': current_note,
                            'note': midi_to_note_name(current_note),
                            'start': round(current_start, 3),
                            'duration': round(duration, 3),
                            'velocity': 100
                        })
                    current_note = None
        
        # Handle last note
        if current_note is not None:
            duration = len(f0) * hop_time - current_start
            if duration >= min_note_duration:
                notes.append({
                    'midi': current_note,
                    'note': midi_to_note_name(current_note),
                    'start': round(current_start, 3),
                    'duration': round(duration, 3),
                    'velocity': 100
                })
        
        # Clean up
        try:
            os.remove(input_path)
        except:
            pass
        
        return jsonify({
            'success': True,
            'notes': notes,
            'total_duration': round(len(f0) * hop_time, 3),
            'note_count': len(notes)
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

def midi_to_note_name(midi):
    """Convert MIDI note number to note name (e.g., 60 -> C4)."""
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    octave = (midi // 12) - 1
    note = note_names[midi % 12]
    return f"{note}{octave}"

@app.route('/karaoke-score', methods=['POST'])
def karaoke_score():
    """
    Compare sung vocals to a reference melody and score accuracy.
    
    Request: multipart/form-data
        - audio: Sung audio file
        - reference_notes: JSON array of expected notes [{midi, start, duration}, ...]
    
    Response: JSON with score and per-note accuracy
    """
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        reference_notes_json = request.form.get('reference_notes', '[]')
        reference_notes = json.loads(reference_notes_json)
        
        if not reference_notes:
            return jsonify({'error': 'No reference notes provided'}), 400
        
        audio_file = request.files['audio']
        
        # Save to temp file
        input_path = os.path.join(tempfile.gettempdir(), f'karaoke_input_{uuid.uuid4().hex}.wav')
        audio_file.save(input_path)
        
        # Load and extract pitch
        audio = load_audio(input_path, sr=16000)
        rmvpe = get_rmvpe()
        f0 = rmvpe.infer_from_audio(audio, thred=0.03)
        
        hop_time = 160 / 16000
        
        # Score each reference note
        note_scores = []
        total_score = 0
        
        for ref_note in reference_notes:
            ref_midi = ref_note['midi']
            start_frame = int(ref_note['start'] / hop_time)
            end_frame = int((ref_note['start'] + ref_note['duration']) / hop_time)
            
            # Get sung pitches in this time range
            sung_pitches = f0[start_frame:end_frame]
            
            if len(sung_pitches) == 0:
                note_scores.append({'note': ref_note, 'score': 0, 'sung_midi': None})
                continue
            
            # Calculate average sung pitch (ignoring silence)
            valid_pitches = [p for p in sung_pitches if p > 0]
            if not valid_pitches:
                note_scores.append({'note': ref_note, 'score': 0, 'sung_midi': None})
                continue
            
            avg_hz = np.mean(valid_pitches)
            sung_midi = hz_to_midi(avg_hz)
            
            # Score based on how close the sung note is to the reference
            # Perfect = 100, off by 1 semitone = 80, off by 2 = 60, etc.
            diff = abs(sung_midi - ref_midi)
            if diff < 0.5:
                score = 100
            elif diff < 1.5:
                score = 80
            elif diff < 2.5:
                score = 60
            elif diff < 3.5:
                score = 40
            else:
                score = max(0, 20 - (diff - 3.5) * 5)
            
            note_scores.append({
                'note': ref_note,
                'score': round(score, 1),
                'sung_midi': round(sung_midi, 1),
                'diff_semitones': round(diff, 2)
            })
            total_score += score
        
        avg_score = total_score / len(reference_notes) if reference_notes else 0
        
        # Clean up
        try:
            os.remove(input_path)
        except:
            pass
        
        return jsonify({
            'success': True,
            'overall_score': round(avg_score, 1),
            'note_scores': note_scores,
            'notes_hit': sum(1 for n in note_scores if n['score'] >= 60),
            'total_notes': len(reference_notes)
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/detect-emotion', methods=['POST'])
def detect_emotion():
    """
    Detect emotion from vocal audio using audio features.
    
    Request: multipart/form-data with 'audio' file
    Response: JSON with emotion predictions
    """
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        
        # Save to temp file
        input_path = os.path.join(tempfile.gettempdir(), f'emotion_input_{uuid.uuid4().hex}.wav')
        audio_file.save(input_path)
        
        import librosa
        
        # Load audio
        audio, sr = librosa.load(input_path, sr=22050, mono=True)
        
        # Extract features for emotion detection
        # Using simple heuristics based on audio features
        
        # Pitch statistics
        audio_16k = librosa.resample(audio, orig_sr=sr, target_sr=16000)
        rmvpe = get_rmvpe()
        f0 = rmvpe.infer_from_audio(audio_16k, thred=0.03)
        valid_f0 = [p for p in f0 if p > 0]
        
        if valid_f0:
            pitch_mean = np.mean(valid_f0)
            pitch_std = np.std(valid_f0)
            pitch_range = max(valid_f0) - min(valid_f0)
        else:
            pitch_mean = 0
            pitch_std = 0
            pitch_range = 0
        
        # Energy/loudness
        rms = librosa.feature.rms(y=audio)[0]
        energy_mean = np.mean(rms)
        energy_std = np.std(rms)
        
        # Tempo/rhythm
        tempo, _ = librosa.beat.beat_track(y=audio, sr=sr)
        tempo = float(tempo) if hasattr(tempo, 'item') else tempo
        
        # Spectral features
        spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=audio, sr=sr))
        
        # Simple emotion classification based on features
        emotions = {
            'happy': 0.0,
            'sad': 0.0,
            'angry': 0.0,
            'calm': 0.0,
            'energetic': 0.0
        }
        
        # High pitch + high energy + fast tempo = happy/energetic
        if pitch_mean > 200 and energy_mean > 0.1 and tempo > 120:
            emotions['happy'] += 0.4
            emotions['energetic'] += 0.4
        
        # Low pitch + low energy + slow tempo = sad/calm
        if pitch_mean < 150 and energy_mean < 0.05 and tempo < 90:
            emotions['sad'] += 0.4
            emotions['calm'] += 0.3
        
        # High energy + high pitch variation = angry/energetic
        if energy_mean > 0.15 and pitch_std > 50:
            emotions['angry'] += 0.3
            emotions['energetic'] += 0.3
        
        # Low energy + low variation = calm
        if energy_mean < 0.08 and pitch_std < 30:
            emotions['calm'] += 0.4
        
        # Normalize
        total = sum(emotions.values())
        if total > 0:
            emotions = {k: round(v / total, 2) for k, v in emotions.items()}
        else:
            emotions = {k: 0.2 for k in emotions}
        
        # Find dominant emotion
        dominant = max(emotions, key=emotions.get)
        
        # Clean up
        try:
            os.remove(input_path)
        except:
            pass
        
        return jsonify({
            'success': True,
            'dominant_emotion': dominant,
            'emotions': emotions,
            'features': {
                'pitch_mean_hz': round(pitch_mean, 1),
                'pitch_std': round(pitch_std, 1),
                'pitch_range': round(pitch_range, 1),
                'energy_mean': round(float(energy_mean), 4),
                'tempo_bpm': round(tempo, 1),
                'spectral_centroid': round(float(spectral_centroid), 1)
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/classify-audio', methods=['POST'])
def classify_audio():
    """
    Classify audio type (vocals, instrumental, speech, etc.)
    
    Request: multipart/form-data with 'audio' file
    Response: JSON with classification
    """
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        
        # Save to temp file
        input_path = os.path.join(tempfile.gettempdir(), f'classify_input_{uuid.uuid4().hex}.wav')
        audio_file.save(input_path)
        
        import librosa
        
        # Load audio
        audio, sr = librosa.load(input_path, sr=22050, mono=True)
        
        # Extract features
        # Pitch presence (vocals have consistent pitch)
        audio_16k = librosa.resample(audio, orig_sr=sr, target_sr=16000)
        rmvpe = get_rmvpe()
        f0 = rmvpe.infer_from_audio(audio_16k, thred=0.03)
        
        pitch_presence = sum(1 for p in f0 if p > 0) / len(f0) if len(f0) > 0 else 0
        
        # Spectral features
        spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=audio, sr=sr))
        spectral_bandwidth = np.mean(librosa.feature.spectral_bandwidth(y=audio, sr=sr))
        spectral_rolloff = np.mean(librosa.feature.spectral_rolloff(y=audio, sr=sr))
        
        # Zero crossing rate (high for speech/percussion)
        zcr = np.mean(librosa.feature.zero_crossing_rate(audio))
        
        # RMS energy
        rms = np.mean(librosa.feature.rms(y=audio))
        
        # Classification logic
        classifications = {
            'vocals': 0.0,
            'instrumental': 0.0,
            'speech': 0.0,
            'percussion': 0.0,
            'ambient': 0.0
        }
        
        # High pitch presence = vocals or speech
        if pitch_presence > 0.5:
            classifications['vocals'] += 0.4
            classifications['speech'] += 0.2
        elif pitch_presence > 0.2:
            classifications['vocals'] += 0.2
            classifications['instrumental'] += 0.2
        else:
            classifications['instrumental'] += 0.3
            classifications['percussion'] += 0.2
        
        # High ZCR = percussion or speech
        if zcr > 0.1:
            classifications['percussion'] += 0.3
            classifications['speech'] += 0.2
        
        # Low energy = ambient
        if rms < 0.02:
            classifications['ambient'] += 0.4
        
        # High spectral bandwidth = complex sound (instrumental)
        if spectral_bandwidth > 2000:
            classifications['instrumental'] += 0.2
        
        # Normalize
        total = sum(classifications.values())
        if total > 0:
            classifications = {k: round(v / total, 2) for k, v in classifications.items()}
        
        # Find dominant
        dominant = max(classifications, key=classifications.get)
        
        # Clean up
        try:
            os.remove(input_path)
        except:
            pass
        
        return jsonify({
            'success': True,
            'classification': dominant,
            'confidence': classifications[dominant],
            'all_classes': classifications,
            'features': {
                'pitch_presence': round(pitch_presence, 2),
                'spectral_centroid': round(float(spectral_centroid), 1),
                'spectral_bandwidth': round(float(spectral_bandwidth), 1),
                'zero_crossing_rate': round(float(zcr), 4),
                'rms_energy': round(float(rms), 4)
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("=" * 60)
    print("Audio Analysis API for CodedSwitch")
    print("=" * 60)
    print("\nEndpoints:")
    print("  GET  /health          - Health check")
    print("  POST /extract-pitch   - Extract pitch (F0) from audio")
    print("  POST /pitch-correct   - Auto-tune vocals to scale")
    print("  POST /extract-melody  - Convert vocals to MIDI notes")
    print("  POST /karaoke-score   - Score sung vocals vs reference")
    print("  POST /detect-emotion  - Detect emotion from vocals")
    print("  POST /classify-audio  - Classify audio type")
    port = int(os.environ.get('PORT', 7871))
    print(f"\nStarting server on port {port}...")
    print("=" * 60)
    app.run(host='0.0.0.0', port=port, debug=False)
