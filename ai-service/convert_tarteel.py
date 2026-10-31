"""Convert the locally downloaded Tarteel checkpoint for faster-whisper."""
import sys
from pathlib import Path

from transformers import AutoTokenizer, PreTrainedModel


# CTranslate2 4.8 passes the modern `dtype` keyword, while the project's
# Transformers 4.46 environment still names it `torch_dtype`.
_from_pretrained = PreTrainedModel.from_pretrained.__func__


@classmethod
def _compatible_from_pretrained(cls, *args, **kwargs):
    if "dtype" in kwargs and "torch_dtype" not in kwargs:
        kwargs["torch_dtype"] = kwargs.pop("dtype")
    return _from_pretrained(cls, *args, **kwargs)


PreTrainedModel.from_pretrained = _compatible_from_pretrained

from ctranslate2.converters.transformers import main  # noqa: E402


if __name__ == "__main__":
    root = Path(__file__).parent
    snapshots = list((root / "models/tarteel-hf/hub/models--tarteel-ai--whisper-base-ar-quran/snapshots").glob("*"))
    if len(snapshots) != 1:
        raise SystemExit("Сначала скачайте один checkpoint tarteel-ai/whisper-base-ar-quran.")
    sys.argv = [
        "ct2-transformers-converter",
        "--model", str(snapshots[0]),
        "--output_dir", str(root / "models/tarteel-faster-whisper-base"),
        "--copy_files", "preprocessor_config.json",
        "--quantization", "int8",
        "--force",
    ]
    main()
    tokenizer = AutoTokenizer.from_pretrained(snapshots[0], use_fast=True, local_files_only=True)
    tokenizer.save_pretrained(root / "models/tarteel-faster-whisper-base")
