import base64,zlib,pathlib
parts=[pathlib.Path(f"scripts/auth_pa{i}.b64").read_text().strip() for i in range(4)]
data=zlib.decompress(base64.b64decode("".join(parts)))
pathlib.Path("backend/src/auth/auth.service.ts").write_bytes(data)
t=data.decode()
assert "PLACEHOLDER" not in t
assert "changePassword" in t
assert "UserStatus" in t
assert "export class AuthService" in t
assert t.count("{")==t.count("}")
print("OK", len(data))
