# backend/main.py

import os
from dotenv import load_dotenv

load_dotenv()

import uuid
import json
import datetime
from typing import List
import concurrent.futures

import numpy as np
import nibabel as nib
import pydicom
from PIL import Image

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydicom.dataset import FileMetaDataset
from pydicom.uid import generate_uid
from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Length", "Content-Range", "Content-Type"],
)

# Check if Supabase is available
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_enabled = supabase_url and supabase_key

if supabase_enabled:
    from supabase import create_client
    supabase = create_client(supabase_url, supabase_key)
    print("Supabase storage enabled")
else:
    supabase = None
    print("Supabase not configured, using local storage only")

UPLOAD_ROOT = "uploads"
os.makedirs(UPLOAD_ROOT, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_ROOT), name="uploads")

def upload_png_to_supabase(study_id, png_filename, local_png_path):
    """Upload PNG to Supabase if enabled"""
    if supabase_enabled:
        try:
            with open(local_png_path, "rb") as f:
                supabase.storage.from_("medical_scans").upload(
                    f"{study_id}/previews/{png_filename}", f
                )
        except Exception as e:
            print(f"Failed to upload to Supabase: {e}")

def get_image_url(study_id: str, filename: str) -> str:
    """Get image URL - either from Supabase or local server"""
    if supabase_enabled:
        return supabase.storage.from_("medical_scans").get_public_url(f"{study_id}/previews/{filename}")
    else:
        return f"http://127.0.0.1:8000/uploads/{study_id}/previews/{filename}"

def convert_nifti_to_png_previews(study_id: str):
    """Convert NIfTI to PNG previews and upload to storage"""
    study_path = os.path.join(UPLOAD_ROOT, study_id)
    image_path = os.path.join(study_path, "image.nii.gz")

    try:
        nifti_img = nib.load(image_path)
        image_array = nifti_img.get_fdata().astype(np.int16)

        preview_path = os.path.join(study_path, "previews")
        os.makedirs(preview_path, exist_ok=True)

        png_paths = []
        for i in range(image_array.shape[2]):
            slice_2d = image_array[:, :, i]
            min_val, max_val = slice_2d.min(), slice_2d.max()
            if max_val > min_val:
                normalized = np.uint8(255 * ((slice_2d - min_val) / (max_val - min_val)))
            else:
                normalized = np.zeros(slice_2d.shape, dtype=np.uint8)
            img = Image.fromarray(normalized)
            png_filename = f"slice_{i:03d}.png"
            local_png_path = os.path.join(preview_path, png_filename)
            img.save(local_png_path, 'PNG', optimize=True)

            png_paths.append((study_id, png_filename, local_png_path))

        # Upload to Supabase if enabled
        if supabase_enabled:
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
                executor.map(lambda args: upload_png_to_supabase(*args), png_paths)

        metadata = {
            "StudyDate": datetime.datetime.utcnow().strftime("%Y%m%d"),
            "PatientID": "PID-001",
            "storage_type": "supabase" if supabase_enabled else "local"
        }
        with open(os.path.join(study_path, "metadata.json"), "w") as f:
            json.dump(metadata, f, indent=4)

        return {
            "study_id": study_id,
            "metadata": metadata
        }

    except Exception as e:
        print(f"Error processing NIfTI file: {e}")
        raise

@app.post("/upload")
async def upload_files(
    background_tasks: BackgroundTasks,
    image_file: UploadFile = File(..., description="NIfTI image file (.nii.gz)")
):
    if not (image_file.filename.endswith(".nii.gz") or image_file.filename.endswith(".nii")):
        raise HTTPException(status_code=400, detail="Image file must be .nii or .nii.gz")

    study_id = str(uuid.uuid4())
    study_folder = os.path.join(UPLOAD_ROOT, study_id)
    os.makedirs(study_folder, exist_ok=True)

    image_path = os.path.join(study_folder, "image.nii.gz")
    with open(image_path, "wb") as f:
        content = await image_file.read()
        f.write(content)

    background_tasks.add_task(convert_nifti_to_png_previews, study_id)

    return JSONResponse(
        status_code=202,
        content={
            "study_id": study_id,
            "message": "Processing started.",
            "storage_type": "supabase" if supabase_enabled else "local"
        }
    )

@app.get("/studies/{study_id}/status")
async def get_study_status(study_id: str):
    study_path = os.path.join(UPLOAD_ROOT, study_id)
    metadata_path = os.path.join(study_path, "metadata.json")

    if not os.path.isdir(study_path):
        raise HTTPException(status_code=404, detail="Study not found")

    if os.path.isfile(metadata_path):
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
        return {
            "status": "complete",
            "metadata": metadata
        }
    else:
        return {"status": "processing"}

@app.get("/studies")
def get_studies():
    studies = []
    if not os.path.exists(UPLOAD_ROOT):
        return {"studies": []}
        
    for study_id in os.listdir(UPLOAD_ROOT):
        study_path = os.path.join(UPLOAD_ROOT, study_id)
        metadata_path = os.path.join(study_path, "metadata.json")
        if os.path.isfile(metadata_path):
            with open(metadata_path, "r") as f:
                metadata = json.load(f)
            studies.append({"study_id": study_id, **metadata})
    return {"studies": studies}

@app.get("/studies/{study_id}/instances")
async def get_study_instances(study_id: str):
    study_path = os.path.join(UPLOAD_ROOT, study_id)
    preview_path = os.path.join(study_path, "previews")
    
    if not os.path.exists(preview_path):
        raise HTTPException(status_code=404, detail="Study previews not found")

    # Get PNG files from local directory
    png_files = []
    if os.path.exists(preview_path):
        for file in os.listdir(preview_path):
            if file.endswith('.png'):
                png_files.append(file)
    
    png_files.sort()
    
    # Generate URLs based on storage type
    image_urls = [get_image_url(study_id, fname) for fname in png_files]

    return {
        "study_id": study_id,
        "image_urls": image_urls,
        "storage_type": "supabase" if supabase_enabled else "local",
        "AvailableClasses": [
            {"value": 1, "label": "Background"},
            {"value": 2, "label": "Anatomical Structure 1"},
            {"value": 3, "label": "Anatomical Structure 2"},
            {"value": 4, "label": "Anatomical Structure 3"}
        ]
    }

@app.get("/")
async def root():
    return {
        "message": "Medical Imaging Backend",
        "supabase_enabled": supabase_enabled,
        "storage_type": "supabase" if supabase_enabled else "local"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)