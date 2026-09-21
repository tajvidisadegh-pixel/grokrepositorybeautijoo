import base64,zlib,pathlib
parts=[
  "eNrlPNtyFEeW"
]
data=zlib.decompress(base64.b64decode("".join(parts)))
path=pathlib.Path("backend/src/auth/auth.service.ts")
path.write_bytes(data)
text=data.decode()
assert "PLACEHOLDER" not in text
assert "changePassword" in text
assert "UserStatus" in text
assert "export class AuthService" in text
assert text.count("{") == text.count("}")
print("OK", len(data))
