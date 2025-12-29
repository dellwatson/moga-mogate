export interface FlightProduct {
  id: string;
  slug: string;
  category: string;
  priceUSD: number;
  seller: { name: string; verified: boolean };
  chain: string;
  metadata_uri: string;
  metadata: {
    name: string;
    symbol: string;
    description: string;
    image: string;
    external_url: string;
    attributes: Array<{ trait_type: string; value: string | number }>;
    properties: {
      category: string;
      files: Array<{ uri: string; type: string }>;
      creators: Array<{ address: string; share: number }>;
    };
  };
}

export const nftProducts: FlightProduct[] = [
  // Solana Devnet - Tixia
  {
    id: "sol-tixia-100",
    slug: "tixia-credit-100",
    category: "Flight",
    priceUSD: 0,
    seller: { name: "Tixia", verified: true },
    chain: "solana-devnet",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/solana/tixia/1o1/100/metadata.json",
    metadata: {
      name: "Tixia $100 Flight Credit",
      symbol: "TIX",
      description:
        "$100 Tixia flight credit. No airline or region restriction.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-100.png",
      external_url: "",
      attributes: [
        { trait_type: "Type", value: "Unique Credit Voucher" },
        { trait_type: "Credit Amount", value: 100 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Category", value: "Flight" },
        { trait_type: "Class", value: "Economy" },
        { trait_type: "Airline", value: "Any" },
        { trait_type: "Region", value: "Worldwide" },
        { trait_type: "Expiration", value: "Never" },
        { trait_type: "Company", value: "Tixia" },
        { trait_type: "Network", value: "solana" },
        { trait_type: "Environment", value: "devnet" },
        { trait_type: "Token Standard", value: "1o1" },
      ],
      properties: {
        category: "travel",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-100.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "tixia", share: 100 }],
      },
    },
  },
  {
    id: "sol-tixia-800-eco",
    slug: "tixia-credit-800-eco",
    category: "Flight",
    priceUSD: 0,
    seller: { name: "Tixia", verified: true },
    chain: "solana-devnet",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/solana/tixia/1o1/800-eco-only/metadata.json",
    metadata: {
      name: "Tixia $800 Economy Credit",
      symbol: "TIX",
      description:
        "$800 Tixia flight credit (economy class only). Any airline. Worldwide.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-800-eco.png",
      external_url: "",
      attributes: [
        { trait_type: "Type", value: "Unique Credit Voucher" },
        { trait_type: "Credit Amount", value: 800 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Category", value: "Flight" },
        { trait_type: "Class", value: "Economy" },
        { trait_type: "Airline", value: "Any" },
        { trait_type: "Region", value: "Worldwide" },
        { trait_type: "Expiration", value: "Never" },
        { trait_type: "Company", value: "Tixia" },
        { trait_type: "Network", value: "solana" },
        { trait_type: "Environment", value: "devnet" },
        { trait_type: "Token Standard", value: "1o1" },
      ],
      properties: {
        category: "travel",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-800-eco.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "tixia", share: 100 }],
      },
    },
  },
  // Solana Devnet - Emiless
  {
    id: "sol-emiless-300-biz",
    slug: "emiless-credit-300-business",
    category: "Flight",
    priceUSD: 0,
    seller: { name: "Emiless", verified: true },
    chain: "solana-devnet",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/solana/emiless/1o1/300-business/metadata.json",
    metadata: {
      name: "Emiless $300 Business #001",
      symbol: "EMI",
      description:
        "Unique $300 business-class flight credit voucher. Serial #001. Any airline worldwide. Redeemable only on emiless.com.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-300-business.png",
      external_url: "https://emiless.com",
      attributes: [
        { trait_type: "Type", value: "Unique Credit Voucher" },
        { trait_type: "Serial Number", value: "001" },
        { trait_type: "Credit Amount", value: 300 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Class", value: "Business" },
        { trait_type: "Airline", value: "Any" },
        { trait_type: "Region", value: "Worldwide" },
        { trait_type: "Expiration", value: "Never" },
        { trait_type: "Company", value: "Emiless" },
        { trait_type: "Network", value: "solana" },
        { trait_type: "Environment", value: "devnet" },
        { trait_type: "Supply", value: 1 },
        { trait_type: "Creator", value: "emiless.com" },
        { trait_type: "Token Standard", value: "1o1" },
      ],
      properties: {
        category: "travel",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-300-business.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "emiless.com", share: 100 }],
      },
    },
  },
  {
    id: "sol-emiless-3000-biz",
    slug: "emiless-credit-3000-business",
    category: "Flight",
    priceUSD: 0,
    seller: { name: "Emiless", verified: true },
    chain: "solana-devnet",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/solana/emiless/1o1/3000-business/metadata.json",
    metadata: {
      name: "Emiless $3000 Business Credit",
      symbol: "EMI",
      description: "$3000 Emiless business-class flight credit.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-3000-business.png",
      external_url: "",
      attributes: [
        { trait_type: "Type", value: "Unique Credit Voucher" },
        { trait_type: "Serial Number", value: "001" },
        { trait_type: "Credit Amount", value: 3000 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Class", value: "Business" },
        { trait_type: "Airline", value: "Any" },
        { trait_type: "Region", value: "Worldwide" },
        { trait_type: "Expiration", value: "Never" },
        { trait_type: "Company", value: "Emiless" },
        { trait_type: "Network", value: "solana" },
        { trait_type: "Environment", value: "devnet" },
        { trait_type: "Supply", value: 1 },
        { trait_type: "Creator", value: "emiless.com" },
      ],
      properties: {
        category: "travel",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-3000-business.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "emiless.com", share: 100 }],
      },
    },
  },
  // Polygon Testnet - Tixia
  {
    id: "poly-tixia-100",
    slug: "polygon-tixia-credit-100",
    category: "Flight",
    priceUSD: 0,
    seller: { name: "Tixia", verified: true },
    chain: "polygon-amoy",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/polygon/tixia/erc721/100/metadata.json",
    metadata: {
      name: "Tixia $100 Flight Credit",
      symbol: "TIX",
      description:
        "$100 Tixia flight credit. No airline or region restriction.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-100.png",
      external_url: "",
      attributes: [
        { trait_type: "Type", value: "Credit Voucher" },
        { trait_type: "Credit Amount", value: 100 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Category", value: "Flight" },
        { trait_type: "Class", value: "Economy" },
        { trait_type: "Airline", value: "Any" },
        { trait_type: "Region", value: "Worldwide" },
        { trait_type: "Expiration", value: "Never" },
        { trait_type: "Company", value: "Tixia" },
        { trait_type: "Network", value: "polygon" },
        { trait_type: "Environment", value: "testnet" },
        { trait_type: "Token Standard", value: "ERC-721" },
        { trait_type: "Creator", value: "tixia" },
      ],
      properties: {
        category: "travel",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-100.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "tixia", share: 100 }],
      },
    },
  },
  {
    id: "poly-tixia-800-eco",
    slug: "polygon-tixia-credit-800-eco",
    category: "Flight",
    priceUSD: 0,
    seller: { name: "Tixia", verified: true },
    chain: "polygon-amoy",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/polygon/tixia/erc721/800-eco-only/metadata.json",
    metadata: {
      name: "Tixia $800 Economy Credit",
      symbol: "TIX",
      description:
        "$800 Tixia flight credit (economy class only). Any airline. Worldwide.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-800-eco.png",
      external_url: "",
      attributes: [
        { trait_type: "Type", value: "Credit Voucher" },
        { trait_type: "Credit Amount", value: 800 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Category", value: "Flight" },
        { trait_type: "Class", value: "Economy" },
        { trait_type: "Airline", value: "Any" },
        { trait_type: "Region", value: "Worldwide" },
        { trait_type: "Expiration", value: "Never" },
        { trait_type: "Company", value: "Tixia" },
        { trait_type: "Network", value: "polygon" },
        { trait_type: "Environment", value: "testnet" },
        { trait_type: "Token Standard", value: "ERC-721" },
        { trait_type: "Creator", value: "tixia" },
      ],
      properties: {
        category: "travel",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-800-eco.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "tixia", share: 100 }],
      },
    },
  },
  // Polygon Testnet - Mentari Gold
  {
    id: "poly-mentari-5000-diamond",
    slug: "polygon-mentari-credit-5000-diamond",
    category: "Jewelry",
    priceUSD: 0,
    seller: { name: "Mentari Gold", verified: true },
    chain: "polygon-amoy",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/polygon/mentari-gold/erc721/5000-diamond/metadata.json",
    metadata: {
      name: "Mentari Gold $5000 (Diamond)",
      symbol: "MG-5K",
      description: "$5000 Mentari Gold credit for diamond jewelry.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/jewelry/mentari-diamond-5000.png",
      external_url: "",
      attributes: [
        { trait_type: "Credit Amount", value: 5000 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Material", value: "Diamond" },
        { trait_type: "Company", value: "Mentari Gold" },
        { trait_type: "Network", value: "polygon" },
        { trait_type: "Environment", value: "testnet" },
        { trait_type: "Token Standard", value: "ERC-721" },
      ],
      properties: {
        category: "jewelry",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/jewelry/mentari-diamond-5000.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "mentari-gold", share: 100 }],
      },
    },
  },
  {
    id: "poly-mentari-12000-any",
    slug: "polygon-mentari-credit-12000-any",
    category: "Jewelry",
    priceUSD: 0,
    seller: { name: "Mentari Gold", verified: true },
    chain: "polygon-amoy",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/polygon/mentari-gold/erc721/12000-any/metadata.json",
    metadata: {
      name: "Mentari Gold $12000 (Any)",
      symbol: "MG-12K",
      description: "$12000 Mentari Gold credit for diamond or gold.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/jewelry/mentari-gold-12000.png",
      external_url: "",
      attributes: [
        { trait_type: "Credit Amount", value: 12000 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Material", value: "Any" },
        { trait_type: "Company", value: "Mentari Gold" },
        { trait_type: "Network", value: "polygon" },
        { trait_type: "Environment", value: "testnet" },
        { trait_type: "Token Standard", value: "ERC-721" },
      ],
      properties: {
        category: "jewelry",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/jewelry/mentari-gold-12000.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "mentari-gold", share: 100 }],
      },
    },
  },
  // Lisk Testnet - Tixia
  {
    id: "lisk-tixia-200",
    slug: "lisk-tixia-credit-200",
    category: "Flight",
    priceUSD: 0,
    seller: { name: "Tixia", verified: true },
    chain: "lisk-sepolia",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/lisk/tixia/erc721/200/metadata.json",
    metadata: {
      name: "Tixia $200 Flight Credit",
      symbol: "TIX",
      description: "$200 Tixia flight credit voucher. Any airline. Worldwide.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-200.png",
      external_url: "",
      attributes: [
        { trait_type: "Type", value: "Credit Voucher" },
        { trait_type: "Credit Amount", value: 200 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Category", value: "Flight" },
        { trait_type: "Class", value: "Economy" },
        { trait_type: "Airline", value: "Any" },
        { trait_type: "Region", value: "Worldwide" },
        { trait_type: "Expiration", value: "Never" },
        { trait_type: "Company", value: "Tixia" },
        { trait_type: "Network", value: "lisk" },
        { trait_type: "Environment", value: "testnet" },
        { trait_type: "Token Standard", value: "ERC-721" },
        { trait_type: "Creator", value: "tixia" },
      ],
      properties: {
        category: "travel",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-200.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "tixia", share: 100 }],
      },
    },
  },
  {
    id: "lisk-tixia-800",
    slug: "lisk-tixia-credit-800",
    category: "Flight",
    priceUSD: 0,
    seller: { name: "Tixia", verified: true },
    chain: "lisk-sepolia",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/lisk/tixia/erc721/800/metadata.json",
    metadata: {
      name: "Tixia $800 Flight Credit",
      symbol: "TIX",
      description: "$800 Tixia flight credit. Any airline. Worldwide.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-800-eco.png",
      external_url: "",
      attributes: [
        { trait_type: "Type", value: "Credit Voucher" },
        { trait_type: "Credit Amount", value: 800 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Category", value: "Flight" },
        { trait_type: "Class", value: "Economy" },
        { trait_type: "Airline", value: "Any" },
        { trait_type: "Region", value: "Worldwide" },
        { trait_type: "Expiration", value: "Never" },
        { trait_type: "Company", value: "Tixia" },
        { trait_type: "Network", value: "lisk" },
        { trait_type: "Environment", value: "testnet" },
        { trait_type: "Token Standard", value: "ERC-721" },
        { trait_type: "Creator", value: "tixia" },
      ],
      properties: {
        category: "travel",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-800-eco.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "tixia", share: 100 }],
      },
    },
  },
  // Lisk Testnet - Emiless
  {
    id: "lisk-emiless-200",
    slug: "lisk-emiless-credit-200",
    category: "Flight",
    priceUSD: 0,
    seller: { name: "Emiless", verified: true },
    chain: "lisk-sepolia",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/lisk/emiless/erc721/200/metadata.json",
    metadata: {
      name: "Emiless $200 Flight Credit",
      symbol: "EMI",
      description:
        "$200 Emiless flight credit voucher. Any airline. Worldwide.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-200.png",
      external_url: "https://emiless.com",
      attributes: [
        { trait_type: "Type", value: "Credit Voucher" },
        { trait_type: "Credit Amount", value: 200 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Category", value: "Flight" },
        { trait_type: "Class", value: "Economy" },
        { trait_type: "Airline", value: "Any" },
        { trait_type: "Region", value: "Worldwide" },
        { trait_type: "Expiration", value: "Never" },
        { trait_type: "Company", value: "Emiless" },
        { trait_type: "Network", value: "lisk" },
        { trait_type: "Environment", value: "testnet" },
        { trait_type: "Token Standard", value: "ERC-721" },
        { trait_type: "Creator", value: "emiless" },
      ],
      properties: {
        category: "travel",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-200.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "emiless", share: 100 }],
      },
    },
  },
  {
    id: "lisk-emiless-800",
    slug: "lisk-emiless-credit-800",
    category: "Flight",
    priceUSD: 0,
    seller: { name: "Emiless", verified: true },
    chain: "lisk-sepolia",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/lisk/emiless/erc721/800/metadata.json",
    metadata: {
      name: "Emiless $800 Flight Credit",
      symbol: "EMI",
      description: "$800 Emiless flight credit. Any airline. Worldwide.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-800-eco.png",
      external_url: "https://emiless.com",
      attributes: [
        { trait_type: "Type", value: "Credit Voucher" },
        { trait_type: "Credit Amount", value: 800 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Category", value: "Flight" },
        { trait_type: "Class", value: "Economy" },
        { trait_type: "Airline", value: "Any" },
        { trait_type: "Region", value: "Worldwide" },
        { trait_type: "Expiration", value: "Never" },
        { trait_type: "Company", value: "Emiless" },
        { trait_type: "Network", value: "lisk" },
        { trait_type: "Environment", value: "testnet" },
        { trait_type: "Token Standard", value: "ERC-721" },
        { trait_type: "Creator", value: "emiless" },
      ],
      properties: {
        category: "travel",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-800-eco.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "emiless", share: 100 }],
      },
    },
  },
  // Casper Testnet - Tixia
  {
    id: "casper-tixia-200",
    slug: "casper-tixia-credit-200",
    category: "Flight",
    priceUSD: 0,
    seller: { name: "Tixia", verified: true },
    chain: "casper-testnet",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/200/metadata.json",
    metadata: {
      name: "Tixia $200 Flight Credit",
      symbol: "TIX",
      description: "$200 Tixia flight credit voucher. Any airline. Worldwide.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-200.png",
      external_url: "",
      attributes: [
        { trait_type: "Type", value: "Credit Voucher" },
        { trait_type: "Credit Amount", value: 200 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Category", value: "Flight" },
        { trait_type: "Class", value: "Economy" },
        { trait_type: "Airline", value: "Any" },
        { trait_type: "Region", value: "Worldwide" },
        { trait_type: "Expiration", value: "Never" },
        { trait_type: "Company", value: "Tixia" },
        { trait_type: "Network", value: "casper" },
        { trait_type: "Environment", value: "testnet" },
        { trait_type: "Token Standard", value: "CEP-78" },
        { trait_type: "Creator", value: "tixia" },
      ],
      properties: {
        category: "travel",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-200.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "tixia", share: 100 }],
      },
    },
  },
  {
    id: "casper-tixia-800",
    slug: "casper-tixia-credit-800",
    category: "Flight",
    priceUSD: 0,
    seller: { name: "Tixia", verified: true },
    chain: "casper-testnet",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/800/metadata.json",
    metadata: {
      name: "Tixia $800 Flight Credit",
      symbol: "TIX",
      description: "$800 Tixia flight credit. Any airline. Worldwide.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-800-eco.png",
      external_url: "",
      attributes: [
        { trait_type: "Type", value: "Credit Voucher" },
        { trait_type: "Credit Amount", value: 800 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Category", value: "Flight" },
        { trait_type: "Class", value: "Economy" },
        { trait_type: "Airline", value: "Any" },
        { trait_type: "Region", value: "Worldwide" },
        { trait_type: "Expiration", value: "Never" },
        { trait_type: "Company", value: "Tixia" },
        { trait_type: "Network", value: "casper" },
        { trait_type: "Environment", value: "testnet" },
        { trait_type: "Token Standard", value: "CEP-78" },
        { trait_type: "Creator", value: "tixia" },
      ],
      properties: {
        category: "travel",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/flights/flight-credit-800-eco.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "tixia", share: 100 }],
      },
    },
  },
  {
    id: "casper-tixia-800-hotel",
    slug: "casper-tixia-hotel-800",
    category: "Hotel",
    priceUSD: 0,
    seller: { name: "Tixia", verified: true },
    chain: "casper-testnet",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/800-hotels/metadata.json",
    metadata: {
      name: "Tixia $800 Hotel Credit",
      symbol: "TIX",
      description: "$800 Tixia hotel credit. Any hotel. Worldwide.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/hotels/hotel-credit-800.png",
      external_url: "",
      attributes: [
        { trait_type: "Type", value: "Credit Voucher" },
        { trait_type: "Credit Amount", value: 800 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Category", value: "Hotel" },
        { trait_type: "Region", value: "Worldwide" },
        { trait_type: "Expiration", value: "Never" },
        { trait_type: "Company", value: "Tixia" },
        { trait_type: "Network", value: "casper" },
        { trait_type: "Environment", value: "testnet" },
        { trait_type: "Token Standard", value: "CEP-78" },
        { trait_type: "Creator", value: "tixia" },
      ],
      properties: {
        category: "travel",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/hotels/hotel-credit-800.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "tixia", share: 100 }],
      },
    },
  },
  {
    id: "casper-tixia-2000-hotel",
    slug: "casper-tixia-hotel-2000",
    category: "Hotel",
    priceUSD: 0,
    seller: { name: "Tixia", verified: true },
    chain: "casper-testnet",
    metadata_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/2000-hotels/metadata.json",
    metadata: {
      name: "Tixia $2000 Hotel Credit",
      symbol: "TIX",
      description: "$2000 Tixia hotel credit. Any hotel. Worldwide.",
      image:
        "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/hotels/hotel-credit-2000.png",
      external_url: "",
      attributes: [
        { trait_type: "Type", value: "Credit Voucher" },
        { trait_type: "Credit Amount", value: 2000 },
        { trait_type: "Credit Currency", value: "USD" },
        { trait_type: "Category", value: "Hotel" },
        { trait_type: "Region", value: "Worldwide" },
        { trait_type: "Expiration", value: "Never" },
        { trait_type: "Company", value: "Tixia" },
        { trait_type: "Network", value: "casper" },
        { trait_type: "Environment", value: "testnet" },
        { trait_type: "Token Standard", value: "CEP-78" },
        { trait_type: "Creator", value: "tixia" },
      ],
      properties: {
        category: "travel",
        files: [
          {
            uri: "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/images/hotels/hotel-credit-2000.png",
            type: "image/png",
          },
        ],
        creators: [{ address: "tixia", share: 100 }],
      },
    },
  },
];
