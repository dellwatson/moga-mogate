# Post-Reorganization Checklist

## ✅ Completed

- [x] Removed Solana dependencies (`@solana/web3.js`, `@coral-xyz/anchor`)
- [x] Removed Express and CORS dependencies
- [x] Created modular `src/core/` directory with reusable utilities
- [x] Created `src/services/` directory for business logic
- [x] Created `src/api/` directory with Bun native server
- [x] Created `scripts/` directory for executable scripts
- [x] Updated `package.json` with clean dependencies
- [x] Updated `package.json` scripts to use new structure
- [x] Created comprehensive documentation (README, MIGRATION, OVERVIEW, etc.)
- [x] Created barrel exports for easy imports

## 🔄 Next Steps (To Do)

### 1. Test the New Structure

```bash
# Install dependencies
cd offchain
bun install

# Test server
bun run server
# In another terminal:
curl http://127.0.0.1:3011/health

# Test signing scripts
bun run sign:host
bun run sign:join
```

### 2. Update TS-SDK Imports (if applicable)

If ts-sdk currently imports from the old `shared.ts`, update to:

```typescript
// Old
import { resolveNetworkTarget } from "../offchain/shared.ts";

// New
import { resolveNetworkTarget } from "../offchain/src/core/index.ts";
```

### 3. Clean Up Old Files

After verifying everything works, remove old files:

```bash
cd offchain
rm server.ts shared.ts worker.ts organizer_db.ts permit_example.ts
rm sign-host-permit.ts sign-join-permit.ts
rm submit-host-permit.ts submit-join-permit.ts
rm README.old.md
```

### 4. Update .gitignore

```bash
cd offchain
mv .gitignore.new .gitignore
```

### 5. Commit Changes

```bash
git add .
git commit -m "refactor(offchain): reorganize for modularity and remove unnecessary deps

- Remove Express, Solana dependencies
- Use Bun native server
- Create modular src/ structure (core, services, api)
- Move scripts to scripts/ directory
- Add comprehensive documentation
- Enable reusability in ts-sdk"
```

## 🧪 Testing Checklist

### Server Tests

- [ ] Server starts without errors: `bun run server`
- [ ] Health endpoint works: `curl http://127.0.0.1:3011/health`
- [ ] Host permit endpoint works: `POST /evm/permit/host`
- [ ] Join permit endpoint works: `POST /evm/permit/join`
- [ ] Host-and-join permit endpoint works: `POST /evm/permit/host-and-join`
- [ ] CORS headers are present
- [ ] API key protection works (if configured)

### Script Tests

- [ ] Sign host permit: `bun run sign:host`
- [ ] Sign join permit: `RAFFLE_ID=test bun run sign:join`
- [ ] Submit host permit (dry run): `DRY_RUN=true bun run submit:host`
- [ ] Submit join permit (dry run): `DRY_RUN=true bun run submit:join`
- [ ] Output files created in `out/` directory

### Import Tests (if using in ts-sdk)

- [ ] Core utilities import correctly
- [ ] Services import correctly
- [ ] API utilities import correctly
- [ ] Types are available

## 📋 Verification Commands

### Check Structure

```bash
tree -L 3 offchain/
```

### Check Dependencies

```bash
cd offchain
bun pm ls
```

### Check Scripts

```bash
cd offchain
bun run --help
```

### Check Imports

```bash
# In ts-sdk or another package
bun run build
```

## 🎯 Success Criteria

- ✅ Server runs on Bun native (no Express)
- ✅ Only 2 production dependencies (ethers, dotenv)
- ✅ All scripts work with new structure
- ✅ Core utilities can be imported by ts-sdk
- ✅ API endpoints return correct responses
- ✅ Documentation is comprehensive

## 🐛 Troubleshooting

### Issue: Import errors

**Solution**: Check that paths use `.ts` extension and are relative/absolute correctly

### Issue: Server won't start

**Solution**: Check `BACKEND_SIGNER_PRIVATE_KEY` is set in `.env`

### Issue: Scripts fail

**Solution**: Verify environment variables are set correctly

### Issue: ts-sdk can't import

**Solution**: Ensure monorepo workspace configuration is correct

## 📝 Notes

- Old files are kept temporarily for reference (marked in .gitignore.new)
- Remove old files only after full verification
- Update any CI/CD pipelines to use new script names
- Update any documentation that references old structure

## 🎉 When Complete

- [ ] All tests pass
- [ ] Old files removed
- [ ] Changes committed
- [ ] Documentation updated
- [ ] Team notified of new structure
