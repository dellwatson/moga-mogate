# NFT Image Sources & Download Guide

## 📁 Directory Structure

```
metadata/images/
├── flights/          # Flight NFT images (18 images needed)
├── hotels/           # Hotel NFT images (4 images needed)
├── luxury/           # Luxury RWA images (4 images needed)
├── travel-credit.png # Travel SFT collection image
└── travel-booking.png # Travel 1/1 collection image
```

## 🎨 Images Needed

### Flights (18 images)

#### SFT Credits (11 images)
1. `credit-500.png` - Generic flight credit card design
2. `credit-2000-sea.png` - Southeast Asia themed
3. `indonesia-economy.png` - Indonesia flag/theme
4. `asia-economy-no-china.png` - Asia map
5. `worldwide-economy-exclude.png` - World map
6. `usa-premium-economy.png` - USA flag/theme
7. `credit-8000-business.png` - Business class seat
8. `europe-business-roundtrip.png` - Europe map
9. `transatlantic-business.png` - Atlantic crossing
10. `middle-east-first.png` - Middle East luxury
11. `credit-15000-first.png` - First class suite

#### 1/1 Bookings (4 images)
12. `qatar-business-doh-lhr.png` - Qatar Airways branding
13. `emirates-first-dxb-jfk.png` - Emirates A380 first class
14. `singapore-suites-sin-lax.png` - Singapore Suites
15. `ana-first-nrt-lhr.png` - ANA first class

#### 1/1 Vouchers (3 images)
16. `credit-3000-premium-001.png` - Premium voucher design
17. `credit-5000-business-001.png` - Business voucher design
18. `credit-10000-first-001.png` - First class voucher design

### Hotels (4 images)

1. `credit-1000.png` - Generic hotel credit
2. `credit-5000-luxury.png` - Luxury hotel
3. `four-seasons-maldives.png` - Overwater villa
4. `burj-al-arab-royal.png` - Burj Al Arab exterior/suite

### Luxury (4 images)

1. `rolex-daytona-platinum.png` - Rolex Daytona 116506
2. `patek-nautilus-blue.png` - Patek Philippe Nautilus 5711
3. `diamond-necklace-5ct.png` - Diamond tennis necklace
4. `hermes-birkin-35.png` - Hermès Birkin 35 black

### Collections (2 images)

1. `travel-credit.png` - Travel credits collection banner
2. `travel-booking.png` - Travel bookings collection banner

## 📥 Quick Download Options

### Option 1: Run Download Script (Placeholders)

```bash
bun run scripts/download-metadata-images.ts
```

This downloads placeholder images from placehold.co for devnet testing.

### Option 2: Use Unsplash (Free Stock Photos)

```bash
# Install unsplash CLI (optional)
npm install -g unsplash-cli

# Or manually download from:
# https://unsplash.com/s/photos/airplane
# https://unsplash.com/s/photos/luxury-hotel
# https://unsplash.com/s/photos/rolex-watch
```

### Option 3: AI-Generated Images

Use Midjourney, DALL-E, or Stable Diffusion with these prompts:

**Flight Credits**:
- "Modern flight credit voucher card, blue gradient, minimalist design, 800x600"
- "Business class airplane seat, luxury interior, professional photo"
- "First class suite, Emirates A380, ultra luxury"

**Hotels**:
- "Overwater villa Maldives, aerial view, turquoise water"
- "Burj Al Arab Dubai, golden hour, luxury architecture"

**Luxury Items**:
- "Rolex Cosmograph Daytona platinum ice blue dial, product photography"
- "Patek Philippe Nautilus blue dial, luxury watch photography"
- "Diamond tennis necklace, white gold, studio lighting"
- "Hermès Birkin 35 black togo leather, product shot"

### Option 4: Manual Download (Recommended for Production)

1. **Flights**: Download from airline websites or stock photos
2. **Hotels**: Download from hotel official websites
3. **Luxury**: Use official product images (with permission)

## 🎨 Image Specifications

### Recommended Specs
- **Format**: PNG or JPG
- **Size**: 800x600 (landscape) or 800x800 (square for luxury)
- **Quality**: High resolution (at least 72 DPI)
- **File size**: < 500KB per image
- **Background**: Clean, professional

### For Devnet Testing
- Placeholders are fine
- Focus on functionality
- Can use simple colored backgrounds with text

### For Production
- Use real product images
- Ensure you have rights/permissions
- Professional photography
- Consistent style across collection

## 🚀 Quick Start (Devnet)

```bash
# 1. Run the download script to get placeholders
bun run scripts/download-metadata-images.ts

# 2. Verify images were created
ls -la metadata/images/flights/
ls -la metadata/images/hotels/
ls -la metadata/images/luxury/

# 3. Commit to GitHub
git add metadata/images/
git commit -m "Add NFT placeholder images"
git push origin main

# 4. Test a URL
curl -I https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/images/flights/credit-500.png
```

## 📝 Image Naming Convention

All image filenames match the metadata JSON files:

```
Metadata: sft-credit-500-any.json
Image:    credit-500.png

Metadata: 1of1-rolex-daytona-platinum.json
Image:    rolex-daytona-platinum.png
```

## ⚠️ Important Notes

1. **Copyright**: Ensure you have rights to use images
2. **Placeholders**: Fine for devnet, replace for mainnet
3. **Consistency**: Use similar style across collection
4. **Optimization**: Compress images before uploading
5. **GitHub**: Max file size 100MB (images should be < 1MB each)

## 🔗 Useful Resources

- **Placeholder Service**: https://placehold.co
- **Free Stock Photos**: https://unsplash.com
- **Image Compression**: https://tinypng.com
- **AI Image Gen**: https://midjourney.com, https://openai.com/dall-e

## ✅ Checklist

- [ ] Create directory structure
- [ ] Download/generate images
- [ ] Verify image sizes and quality
- [ ] Test GitHub raw URLs
- [ ] Replace placeholders for production
- [ ] Commit and push to GitHub
