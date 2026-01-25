# serde-map-to-array &emsp; [![ci_badge]][ci] [![crates_io_badge]][crates_io] [![docs_badge]][docs] [![msrv_badge]][msrv]

[ci_badge]: https://gitlab.com/Fraser999/serde-map-to-array/badges/main/pipeline.svg
[ci]: https://gitlab.com/Fraser999/serde-map-to-array/-/commits/main
[crates_io_badge]: https://img.shields.io/crates/v/serde-map-to-array.svg
[crates_io]: https://crates.io/crates/serde-map-to-array
[docs_badge]: https://docs.rs/serde-map-to-array/badge.svg
[docs]: https://docs.rs/serde-map-to-array
[msrv_badge]: https://img.shields.io/badge/rust-1.56+-blue.svg?label=Required%20Rust
[msrv]: https://github.com/rust-lang/rust/blob/master/RELEASES.md#version-1560-2021-10-21

---

This crate provides unofficial serde helpers to support converting a map to a sequence of named
key-value pairs for
[human-readable encoding formats](https://docs.rs/serde/latest/serde/ser/trait.Serializer.html#method.is_human_readable).

This allows for a stable schema in the face of a mutable map.

For example, let's say we have a map containing the values
`[(1, "one"), (2, "two"), (3, "three")]`.  Encoded to JSON this is:

```json
{"1":"one","2":"two","3":"three"}
```

We cannot specify a schema for this JSON Object though unless the contents of the map are
guaranteed to always contain three entries under the keys `1`, `2` and `3`.

This crate allows for such a map to be encoded to a JSON Array of Objects, each containing
exactly two elements with static names:

```json
[{"key":1,"value":"one"},{"key":2,"value":"two"},{"key":3,"value":"three"}]
```

for which a schema *can* be generated.

Furthermore, this avoids encoding the key type of the map to a string.

By default, the key-value pairs will be given the labels "key" and "value", but this can be
modified by providing your own labels via a struct which implements
[`KeyValueLabels`](https://docs.rs/serde-map-to-array/latest/serde_map_to_array/trait.KeyValueLabels.html).

Note that for binary (non-human-readable) encoding formats, default serialization and
deserialization is retained.

## `no_std`

By default, the crate is `no_std`, but uses `alloc`.  In this case, support for `BTreeMap`s and
`BTreeMap`-like types is provided.

If feature `std` is enabled then support for `HashMap`s and `HashMap`-like types is also
provided, but `no_std` support is disabled.

## Examples

### Using the default field values "key" and "value"
```rust
use std::collections::BTreeMap;
use serde::{Deserialize, Serialize};
use serde_map_to_array::BTreeMapToArray;

#[derive(Default, Serialize, Deserialize)]
struct Data {
    #[serde(with = "BTreeMapToArray::<u64, String>")]
    inner: BTreeMap<u64, String>,
}

let mut data = Data::default();
data.inner.insert(1, "one".to_string());
data.inner.insert(2, "two".to_string());

assert_eq!(
    serde_json::to_string(&data).unwrap(),
    r#"{"inner":[{"key":1,"value":"one"},{"key":2,"value":"two"}]}"#
);
```

### Using non-default field labels
```rust
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use serde_map_to_array::{KeyValueLabels, HashMapToArray};

struct MyKeyValueLabels;

impl KeyValueLabels for MyKeyValueLabels {
    const KEY: &'static str = "id";
    const VALUE: &'static str = "name";
}

#[derive(Default, Serialize, Deserialize)]
struct Data {
    #[serde(with = "HashMapToArray::<u64, String, MyKeyValueLabels>")]
    inner: HashMap<u64, String>,
}

let mut data = Data::default();
data.inner.insert(1, "one".to_string());
data.inner.insert(2, "two".to_string());
// The hashmap orders the entries randomly.
let expected_json = if *data.inner.keys().next().unwrap() == 1 {
    r#"{"inner":[{"id":1,"name":"one"},{"id":2,"name":"two"}]}"#
} else {
    r#"{"inner":[{"id":2,"name":"two"},{"id":1,"name":"one"}]}"#
};

assert_eq!(serde_json::to_string(&data).unwrap(), expected_json);
```

### Using a custom `BTreeMap`-like type
```rust
use std::collections::{btree_map, BTreeMap};
use serde::{Deserialize, Serialize};
use serde_map_to_array::{BTreeMapToArray, DefaultLabels};

#[derive(Serialize, Deserialize)]
struct MyMap(BTreeMap<u64, String>);

/// We need to implement `IntoIterator` to allow serialization.
impl<'a> IntoIterator for &'a MyMap {
    type Item = (&'a u64, &'a String);
    type IntoIter = btree_map::Iter<'a, u64, String>;
    fn into_iter(self) -> Self::IntoIter {
        self.0.iter()
    }
}

/// We need to implement `From<BTreeMap>` to allow deserialization.
impl From<BTreeMap<u64, String>> for MyMap {
    fn from(map: BTreeMap<u64, String>) -> Self {
        MyMap(map)
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    #[serde(with = "BTreeMapToArray::<u64, String, DefaultLabels, MyMap>")]
    inner: MyMap,
}
```

### Using a `HashMap` with a non-standard hasher
```rust
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use hash_hasher::HashBuildHasher;
use serde_map_to_array::{DefaultLabels, HashMapToArray};

#[derive(Serialize, Deserialize)]
struct Data {
    #[serde(with = "HashMapToArray::<u64, String, DefaultLabels, HashBuildHasher>")]
    inner: HashMap<u64, String, HashBuildHasher>,
}
```

### Using a custom `HashMap`-like type
```rust
use std::collections::{hash_map::{self, RandomState}, HashMap};
use serde::{Deserialize, Serialize};
use serde_map_to_array::{DefaultLabels, HashMapToArray};

#[derive(Serialize, Deserialize)]
struct MyMap(HashMap<u64, String>);

/// We need to implement `IntoIterator` to allow serialization.
impl<'a> IntoIterator for &'a MyMap {
    type Item = (&'a u64, &'a String);
    type IntoIter = hash_map::Iter<'a, u64, String>;
    fn into_iter(self) -> Self::IntoIter {
        self.0.iter()
    }
}

/// We need to implement `From<HashMap>` to allow deserialization.
impl From<HashMap<u64, String>> for MyMap {
    fn from(map: HashMap<u64, String>) -> Self {
        MyMap(map)
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    #[serde(with = "HashMapToArray::<u64, String, DefaultLabels, RandomState, MyMap>")]
    inner: MyMap,
}
```

## JSON Schema Support

Support for generating JSON schemas via [`schemars`](https://graham.cool/schemars) can be
enabled by setting the feature `json-schema`.

By default, the schema name of the KeyValue struct will be set to
`"KeyValue_for_{K::schema_name()}_and_{V::schema_name()}"`, and the struct and its key and value
fields will have no descriptions (normally generated from doc comments for the struct and its
fields).  Each of these can be modified by providing your own values via a struct which implements
[`KeyValueJsonSchema`](https://docs.rs/serde-map-to-array/latest/serde_map_to_array/trait.KeyValueJsonSchema.html).

##  License

`serde-map-to-array` is distributed under the terms of both the MIT license and the Apache License (Version 2.0).

See [LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE) for details.
