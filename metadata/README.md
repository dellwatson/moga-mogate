# MOGA Token Metadata

This directory contains the metadata for the MOGA token that will be hosted on GitHub.

## Files

- **`moga-token.json`** - Token metadata (name, symbol, description, image)
- **`moga-logo.png`** - Token logo image (replace with your actual logo)

## Usage

The metadata is referenced via GitHub raw URLs:
```
https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/moga-token.json
```

## Setup Instructions

### 1. Add Your Logo

Replace `moga-logo.png` with your actual MOGA token logo:
- **Format:** PNG (recommended) or JPG
- **Size:** 500x500 to 1000x1000 pixels
- **Aspect ratio:** 1:1 (square)
- **File size:** < 1 MB

### 2. Update metadata JSON (if needed)

Edit `moga-token.json` to customize:
- Description
- External URL
- Attributes

### 3. Commit and Push

```bash
git add metadata/
git commit -m "Add MOGA token metadata"
git push origin main
```

### 4. Run Metadata Script

```bash
bun run scripts/1b-add-token-metadata-github.ts
```

## Benefits of GitHub Hosting

✅ **Free** - No cost for hosting  
✅ **Easy to update** - Just edit and push  
✅ **Version control** - Track changes over time  
✅ **Fast** - GitHub CDN is reliable  
✅ **No blockchain transaction needed** - Update metadata by editing JSON

## Updating Metadata

To update your token's metadata:

1. Edit `moga-token.json`
2. Commit and push to GitHub
3. Wait 1-2 minutes for cache to clear
4. Metadata updates automatically (no transaction needed!)

**Note:** The on-chain metadata account only stores the URI. The actual metadata is fetched from GitHub.

## Metadata JSON Structure

```json
{
  "name": "Mogate Token",
  "symbol": "MOGA",
  "description": "Your description here",
  "image": "https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/moga-logo.png",
  "external_url": "https://mogate.io",
  "attributes": [
    {
      "trait_type": "Type",
      "value": "Utility Token"
    }
  ],
  "properties": {
    "category": "fungible-token",
    "files": [
      {
        "uri": "https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/moga-logo.png",
        "type": "image/png"
      }
    ]
  }
}
```

## Important Notes

- Make sure your GitHub repo is **public** (or the raw URLs won't work)
- The metadata JSON must be valid JSON (use a validator if unsure)
- Image URLs must be publicly accessible
- Changes to JSON take effect immediately (no blockchain transaction)
- The on-chain metadata account is immutable (points to this GitHub URL)

## Troubleshooting

### "Cannot access metadata JSON"

**Solution:** Make sure you've pushed to GitHub and the repo is public.

```bash
git push origin main
```

### "Image not loading"

**Solution:** Make sure `moga-logo.png` exists and is pushed to GitHub.

### "Metadata not updating"

**Solution:** Clear cache or wait 1-2 minutes for GitHub CDN to update.

## Alternative: Use Your Own CDN

If you prefer, you can host the metadata on your own CDN:

1. Upload `moga-token.json` and `moga-logo.png` to your CDN
2. Update the `uri` in the script to point to your CDN
3. Run the script

Example:
```typescript
const METADATA = {
  name: "Mogate Token",
  symbol: "MOGA",
  uri: "https://cdn.mogate.io/metadata/moga-token.json",
};
```
