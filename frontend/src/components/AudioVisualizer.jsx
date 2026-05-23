import { useEffect, useRef } from "react";

export default function AudioVisualizer({ isRecording }) {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);

  const cleanupAudio = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.parentElement.clientWidth || 300;
    canvas.height = 80;

    const drawStaticLine = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    if (!isRecording) {
      drawStaticLine();
      cleanupAudio();
      return;
    }

    // Start Audio Analyzer
    const startAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
          if (!analyserRef.current) return;
          animationFrameRef.current = requestAnimationFrame(draw);

          analyserRef.current.getByteTimeDomainData(dataArray);

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw neon gradient wave
          const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
          gradient.addColorStop(0, "#3b82f6");
          gradient.addColorStop(0.5, "#8b5cf6");
          gradient.addColorStop(1, "#10b981");

          ctx.lineWidth = 3;
          ctx.strokeStyle = gradient;
          ctx.beginPath();

          const sliceWidth = canvas.width / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0; // Normalized between 0 and 2
            const y = (v * canvas.height) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }

            x += sliceWidth;
          }

          ctx.lineTo(canvas.width, canvas.height / 2);
          ctx.stroke();
        };

        draw();
      } catch (err) {
        console.warn("Failed to access microphone for visualization, falling back to mock wave", err);
        // Fallback simple mock wave animation
        let tick = 0;
        const drawMock = () => {
          if (!isRecording) return;
          animationFrameRef.current = requestAnimationFrame(drawMock);
          tick += 0.15;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.beginPath();
          ctx.moveTo(0, canvas.height / 2);

          const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
          gradient.addColorStop(0, "#3b82f6");
          gradient.addColorStop(0.5, "#8b5cf6");
          gradient.addColorStop(1, "#10b981");
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 3;

          for (let x = 0; x < canvas.width; x++) {
            // Draw a combined sine wave
            const y = canvas.height / 2 + 
              Math.sin(x * 0.05 + tick) * 15 * Math.sin(x * 0.01) +
              Math.sin(x * 0.1 - tick) * 5;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        };
        drawMock();
      }
    };

    startAudio();

    return () => {
      cleanupAudio();
    };
  }, [isRecording]);

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          maxHeight: "80px",
          display: "block",
          borderRadius: "0.5rem",
          background: "rgba(15, 23, 42, 0.2)",
          border: "1px solid rgba(255, 255, 255, 0.03)",
        }}
      />
    </div>
  );
}
