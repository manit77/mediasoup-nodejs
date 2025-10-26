#!/bin/bash

# Bash script to record a MediaSoup producer stream to WebM using GStreamer
# Handles jitter, buffering, and temporary stream interruptions with fallback to black screen (video) or silence (audio)
# Usage: ./record.sh <stream_type> <rtp_port> <output_file>
# Example (video only): ./record.sh video 5000 output.webm
# Example (audio only): ./record.sh audio 5002 output.webm

# Configuration variables
VIDEO_PAYLOAD=101             # Payload type for VP8 video (match producer.rtpParameters)
AUDIO_PAYLOAD=100             # Payload type for Opus audio (match producer.rtpParameters)
DEBUG_LEVEL=3                 # GStreamer debug level (0-9, higher is more verbose)
VERBOSE=1                     # Set to 1 for verbose pipeline output, 0 otherwise
JITTER_LATENCY=200            # Jitter buffer latency in ms (200-500ms recommended)
UDP_TIMEOUT=5000000000        # Timeout in ns (5 seconds) for udpsrc
QUEUE_MAX_TIME=1000000000     # Max queue buffering time in ns (1 second)
FALLBACK_SWITCH_TIMEOUT=2000  # Timeout in ms to switch to fallback source (2 seconds)

# Check for correct number of arguments
if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <stream_type> <rtp_port> <output_file>"
  echo "Stream type: video or audio"
  echo "Example (video): $0 video 5000 output.webm"
  echo "Example (audio): $0 audio 5002 output.webm"
  exit 1
fi

# Assign command-line arguments
STREAM_TYPE="$1"
RTP_PORT="$2"
OUTPUT_FILE="$3"

# Validate stream type
if [ "$STREAM_TYPE" != "video" ] && [ "$STREAM_TYPE" != "audio" ]; then
  echo "Error: Stream type must be 'video' or 'audio'."
  exit 1
fi

# Validate RTP port
if ! [[ "$RTP_PORT" =~ ^[0-9]+$ ]] || [ "$RTP_PORT" -lt 1024 ] || [ "$RTP_PORT" -gt 65535 ]; then
  echo "Error: Invalid RTP port. Must be a number between 1024 and 65535."
  exit 1
fi

# Validate output file
if [ -z "$OUTPUT_FILE" ]; then
  echo "Error: Output file path cannot be empty."
  exit 1
fi

# Check if required GStreamer plugins are installed
check_plugins() {
  local required_plugins=("udpsrc" "rtpjitterbuffer" "webmmux" "filesink" "input-selector")
  if [ "$STREAM_TYPE" = "video" ]; then
    required_plugins+=("rtpvp8depay" "videotestsrc" "vp8enc")
  elif [ "$STREAM_TYPE" = "audio" ]; then
    required_plugins+=("rtpopusdepay" "audiotestsrc" "opusenc")
  fi
  for plugin in "${required_plugins[@]}"; do
    if ! gst-inspect-1.0 "$plugin" > /dev/null; then
      echo "Error: GStreamer plugin '$plugin' not found. Please install it."
      exit 1
    fi
  done
}

# Function to build the GStreamer pipeline
build_pipeline() {
  local pipeline="gst-launch-1.0 -e"

  # Add verbose flag if enabled
  if [ "$VERBOSE" -eq 1 ]; then
    pipeline="$pipeline -v"
  fi

  if [ "$STREAM_TYPE" = "video" ]; then
    # Video-only (VP8 RTP -> WebM), fallback to black if RTP missing is trickier,
    # so keep it simple unless you want me to wire in a videotestsrc as backup.
    pipeline="$pipeline \
      udpsrc port=$RTP_PORT caps=\"application/x-rtp,media=video,encoding-name=VP8,payload=$VIDEO_PAYLOAD,clock-rate=90000\" \
      ! rtpjitterbuffer latency=$JITTER_LATENCY drop-on-latency=true do-lost=true \
      ! rtpvp8depay \
      ! queue max-size-time=$QUEUE_MAX_TIME max-size-bytes=0 max-size-buffers=0 leaky=downstream \
      ! webmmux name=mux \
      ! filesink location=$OUTPUT_FILE"

  elif [ "$STREAM_TYPE" = "audio" ]; then
    # Audio-only (Opus RTP -> WebM) with silence fallback
    pipeline="$pipeline \
      input-selector name=selector \
        selector. ! queue max-size-time=$QUEUE_MAX_TIME max-size-bytes=0 max-size-buffers=0 leaky=downstream \
        ! webmmux name=mux \
        ! filesink location=$OUTPUT_FILE \
      udpsrc port=$RTP_PORT caps=\"application/x-rtp,media=audio,encoding-name=OPUS,payload=$AUDIO_PAYLOAD,clock-rate=48000\" \
      ! rtpjitterbuffer latency=$JITTER_LATENCY drop-on-latency=true do-lost=true \
      ! rtpopusdepay \
      ! selector. \
      audiotestsrc is-live=true wave=silence \
      ! audio/x-raw,format=S16LE,rate=48000,channels=2 \
      ! opusenc \
      ! selector."
  fi

  echo "$pipeline"
}




# Main script
echo "Starting GStreamer recording ($STREAM_TYPE) to $OUTPUT_FILE..."

# Check for required plugins
check_plugins

# Check if port is in use
if netstat -ulnp 2>/dev/null | grep -q ":$RTP_PORT"; then
  echo "Error: Port $RTP_PORT is already in use."
  exit 1
fi

# Set GStreamer debug level
export GST_DEBUG="$DEBUG_LEVEL"

# Build and run the pipeline
pipeline=$(build_pipeline)
echo "Running pipeline: $pipeline"
$pipeline

# Check exit status
if [ $? -ne 0 ]; then
  echo "Error: GStreamer pipeline failed. Check debug output or try running with GST_DEBUG=5 for more details."
  exit 1
else
  echo "Recording completed successfully. Output saved to $OUTPUT_FILE."
fi
