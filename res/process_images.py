import base64
import mimetypes


def image_to_data_uri(path):
    mime_type, _ = mimetypes.guess_type(path)
    with open(path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


file_names = [("cp437_9x16", "png")]
for (file_name, ext) in file_names:
    data_uri = image_to_data_uri(f"{file_name}.{ext}")
    with open(f"{file_name}.js", "w") as cp437:
        cp437.write(f'const {file_name}Data = "{data_uri}";')
