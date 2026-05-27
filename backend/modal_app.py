import modal
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware


def _download_crepe_weights():
    """Runs inside the image during build to bake in CREPE model weights."""
    import numpy as np
    import crepe
    dummy = np.zeros(1024, dtype=np.float32)
    # viterbi=False avoids an extra scipy dep during build
    crepe.predict(dummy, 16000, model_capacity="small", viterbi=False, verbose=0)


image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("libsndfile1", "curl")
    .pip_install(
        "setuptools",
        "wheel",
        "fastapi==0.136.1",
        "python-multipart==0.0.29",
        "tensorflow==2.21.0",
        "keras==3.14.1",
        "soundfile==0.13.1",
        "numpy==2.4.6",
        "av==17.0.1",
        "resampy",   # crepe runtime dep
        "scipy",     # crepe runtime dep (viterbi)
    )
    # crepe 0.0.16 imports pkg_resources in setup.py; pip's subprocess can't find it
    # on Python 3.12+ (even with setuptools installed). Bypass pip entirely:
    # curl the tarball from Modal's PyPI mirror, patch the import to use setuptools
    # (same API), then run setup.py install directly in Python (not pip's subprocess).
    .run_commands(
        "curl -fsSL 'https://files.pythonhosted.org/packages/source/c/crepe/crepe-0.0.16.tar.gz'"
        " -o /tmp/crepe.tar.gz"
        " && tar xzf /tmp/crepe.tar.gz -C /tmp"
        " && sed -i 's/import pkg_resources/import setuptools as pkg_resources/'"
        " /tmp/crepe-0.0.16/setup.py"
        " && python3 /tmp/crepe-0.0.16/setup.py install"
    )
    # Copy pitch_analyzer into the image so it's importable without the backend package
    .add_local_file("backend/pitch_analyzer.py", "/root/pitch_analyzer.py")
    # Pre-download CREPE weights so cold starts don't re-download the model
    .run_function(_download_crepe_weights)
)

app = modal.App("singing-coach-backend", image=image)

MAX_AUDIO_BYTES = 50 * 1024 * 1024  # 50 MB


@app.function(timeout=120, memory=2048)
@modal.asgi_app()
def fastapi_app():
    import sys
    sys.path.insert(0, "/root")  # make pitch_analyzer importable
    from pitch_analyzer import analyze_bytes  # noqa: E402

    web = FastAPI()
    web.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    @web.get("/health")
    async def health():
        return {"status": "ok"}

    @web.post("/analyze-pitch")
    async def analyze_pitch(audio: UploadFile = File(...)):
        data = await audio.read()
        if len(data) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="Audio file too large (max 50 MB)")
        try:
            result = analyze_bytes(data)
        except Exception as exc:
            raise HTTPException(
                status_code=422, detail=f"Audio processing failed: {exc}"
            ) from exc
        return result

    return web
