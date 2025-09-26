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
from supabase import create_client

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Length", "Content-Range", "Content-Type"],
)

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(supabase_url, supabase_key)

UPLOAD_ROOT = "uploads"
os.makedirs(UPLOAD_ROOT, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_ROOT), name="uploads")

def upload_png_to_supabase(study_id, png_filename, local_png_path):
    with open(local_png_path, "rb") as f:
        supabase.storage.from_("medical_scans").upload(
            f"{study_id}/previews/{png_filename}", f
        )

def convert_nifti_to_png_previews(study_id: str):
    study_path = os.path.join(UPLOAD_ROOT, study_id)
    image_path = os.path.join(study_path, "image.nii.gz")

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

    # Parallel upload
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        executor.map(lambda args: upload_png_to_supabase(*args), png_paths)

    metadata = {
        "StudyDate": datetime.datetime.utcnow().strftime("%Y%m%d"),
        "PatientID": "PID-001"
    }
    with open(os.path.join(study_path, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=4)

    return {
        "study_id": study_id,
        "metadata": metadata
    }

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
            "message": "Processing started."
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
    res = supabase.storage.from_("medical_scans").list(f"{study_id}/previews")
    png_files = [item['name'] for item in res if item['name'].endswith('.png')]

    image_urls = [
        supabase.storage.from_("medical_scans").get_public_url(f"{study_id}/previews/{fname}")
        for fname in sorted(png_files)
    ]

    return {
        "study_id": study_id,
        "image_urls": image_urls,
    }