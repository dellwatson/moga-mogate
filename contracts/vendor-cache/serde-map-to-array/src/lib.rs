//! This crate provides unofficial serde helpers to support converting a map to a sequence of named
//! key-value pairs for [human-readable encoding formats](Serializer::is_human_readable()).
//!
//! This allows for a stable schema in the face of a mutable map.
//!
//! For example, let's say we have a map containing the values
//! `[(1, "one"), (2, "two"), (3, "three")]`.  Encoded to JSON this is:
//! ```json
//! {"1":"one","2":"two","3":"three"}
//! ```
//! We cannot specify a schema for this JSON Object though unless the contents of the map are
//! guaranteed to always contain three entries under the keys `1`, `2` and `3`.
//!
//! This crate allows for such a map to be encoded to a JSON Array of Objects, each containing
//! exactly two elements with static names:
//! ```json
//! [{"key":1,"value":"one"},{"key":2,"value":"two"},{"key":3,"value":"three"}]
//! ```
//! for which a schema *can* be generated.
//!
//! Furthermore, this avoids encoding the key type of the map to a string.
//!
//! By default, the key-value pairs will be given the labels "key" and "value", but this can be
//! modified by providing your own labels via a struct which implements [`KeyValueLabels`].
//!
//! Note that for binary (non-human-readable) encoding formats, default serialization and
//! deserialization is retained.
//!
//! # `no_std`
//!
//! By default, the crate is `no_std`, but uses `alloc`.  In this case, support for `BTreeMap`s and
//! `BTreeMap`-like types is provided.
//!
//! If feature `std` is enabled then support for `HashMap`s and `HashMap`-like types is also
//! provided, but `no_std` support is disabled.
//!
//! # Examples
//!
//! ## Using the default field values "key" and "value"
//! ```
//! use std::collections::BTreeMap;
//! use serde::{Deserialize, Serialize};
//! use serde_map_to_array::BTreeMapToArray;
//!
//! #[derive(Default, Serialize, Deserialize)]
//! struct Data {
//!     #[serde(with = "BTreeMapToArray::<u64, String>")]
//!     inner: BTreeMap<u64, String>,
//! }
//!
//! let mut data = Data::default();
//! data.inner.insert(1, "one".to_string());
//! data.inner.insert(2, "two".to_string());
//!
//! assert_eq!(
//!     serde_json::to_string(&data).unwrap(),
//!     r#"{"inner":[{"key":1,"value":"one"},{"key":2,"value":"two"}]}"#
//! );
//! ```
//!
//! ## Using non-default field labels
//! ```
//! # #[cfg(feature = "std")] { // make the doctest a no-op when "std" is disabled
//! use std::collections::HashMap;
//! use serde::{Deserialize, Serialize};
//! use serde_map_to_array::{KeyValueLabels, HashMapToArray};
//!
//! struct MyKeyValueLabels;
//!
//! impl KeyValueLabels for MyKeyValueLabels {
//!     const KEY: &'static str = "id";
//!     const VALUE: &'static str = "name";
//! }
//!
//! #[derive(Default, Serialize, Deserialize)]
//! struct Data {
//!     #[serde(with = "HashMapToArray::<u64, String, MyKeyValueLabels>")]
//!     inner: HashMap<u64, String>,
//! }
//!
//! let mut data = Data::default();
//! data.inner.insert(1, "one".to_string());
//! data.inner.insert(2, "two".to_string());
//!
//! // The hashmap orders the entries randomly.
//! let expected_json = if *data.inner.keys().next().unwrap() == 1 {
//!     r#"{"inner":[{"id":1,"name":"one"},{"id":2,"name":"two"}]}"#
//! } else {
//!     r#"{"inner":[{"id":2,"name":"two"},{"id":1,"name":"one"}]}"#
//! };
//!
//! assert_eq!(serde_json::to_string(&data).unwrap(), expected_json);
//! # }
//! ```
//!
//! ## Using a custom `BTreeMap`-like type
//! ```
//! use std::collections::{btree_map, BTreeMap};
//! use serde::{Deserialize, Serialize};
//! use serde_map_to_array::{BTreeMapToArray, DefaultLabels};
//!
//! #[derive(Serialize, Deserialize)]
//! struct MyMap(BTreeMap<u64, String>);
//!
//! /// We need to implement `IntoIterator` to allow serialization.
//! impl<'a> IntoIterator for &'a MyMap {
//!     type Item = (&'a u64, &'a String);
//!     type IntoIter = btree_map::Iter<'a, u64, String>;
//!
//!     fn into_iter(self) -> Self::IntoIter {
//!         self.0.iter()
//!     }
//! }
//!
//! /// We need to implement `From<BTreeMap>` to allow deserialization.
//! impl From<BTreeMap<u64, String>> for MyMap {
//!     fn from(map: BTreeMap<u64, String>) -> Self {
//!         MyMap(map)
//!     }
//! }
//!
//! #[derive(Serialize, Deserialize)]
//! struct Data {
//!     #[serde(with = "BTreeMapToArray::<u64, String, DefaultLabels, MyMap>")]
//!     inner: MyMap,
//! }
//! ```
//!
//! ## Using a `HashMap` with a non-standard hasher
//! ```
//! # #[cfg(feature = "std")] { // make the doctest a no-op when "std" is disabled
//! use std::collections::HashMap;
//! use serde::{Deserialize, Serialize};
//! use hash_hasher::HashBuildHasher;
//! use serde_map_to_array::{DefaultLabels, HashMapToArray};
//!
//! #[derive(Serialize, Deserialize)]
//! struct Data {
//!     #[serde(with = "HashMapToArray::<u64, String, DefaultLabels, HashBuildHasher>")]
//!     inner: HashMap<u64, String, HashBuildHasher>,
//! }
//! # }
//! ```
//!
//! ## Using a custom `HashMap`-like type
//! ```
//! # #[cfg(feature = "std")] { // make the doctest a no-op when "std" is disabled
//! use std::collections::{hash_map::{self, RandomState}, HashMap};
//! use serde::{Deserialize, Serialize};
//! use serde_map_to_array::{DefaultLabels, HashMapToArray};
//!
//! #[derive(Serialize, Deserialize)]
//! struct MyMap(HashMap<u64, String>);
//!
//! /// We need to implement `IntoIterator` to allow serialization.
//! impl<'a> IntoIterator for &'a MyMap {
//!     type Item = (&'a u64, &'a String);
//!     type IntoIter = hash_map::Iter<'a, u64, String>;
//!
//!     fn into_iter(self) -> Self::IntoIter {
//!         self.0.iter()
//!     }
//! }
//!
//! /// We need to implement `From<HashMap>` to allow deserialization.
//! impl From<HashMap<u64, String>> for MyMap {
//!     fn from(map: HashMap<u64, String>) -> Self {
//!         MyMap(map)
//!     }
//! }
//!
//! #[derive(Serialize, Deserialize)]
//! struct Data {
//!     #[serde(with = "HashMapToArray::<u64, String, DefaultLabels, RandomState, MyMap>")]
//!     inner: MyMap,
//! }
//! # }
//! ```
//!
//! # JSON Schema Support
//!
//! Support for generating JSON schemas via [`schemars`](https://graham.cool/schemars) can be
//! enabled by setting the feature `json-schema`.
//!
//! By default, the schema name of the KeyValue struct will be set to
//! `"KeyValue_for_{K::schema_name()}_and_{V::schema_name()}"`, and the struct and its key and value
//! fields will have no descriptions (normally generated from doc comments for the struct and its
//! fields).  Each of these can be modified by providing your own values via a struct which
//! implements [`KeyValueJsonSchema`].

#![cfg_attr(not(feature = "std"), no_std)]
#![warn(missing_docs)]
#![doc(test(attr(deny(warnings))))]
#![cfg_attr(docsrs, feature(doc_auto_cfg))]

#[doc = include_str!("../README.md")]
#[cfg(all(doctest, feature = "std"))]
pub struct ReadmeDoctests;

#[cfg(test)]
mod tests;

extern crate alloc;

use alloc::collections::BTreeMap;
use core::{fmt, marker::PhantomData};
#[cfg(feature = "std")]
use std::{
    collections::{hash_map::RandomState, HashMap},
    hash::{BuildHasher, Hash},
};

#[cfg(feature = "json-schema")]
use schemars::{
    gen::SchemaGenerator,
    schema::{InstanceType, Schema, SchemaObject},
    JsonSchema,
};

use serde::{
    de::{Error as SerdeError, MapAccess, SeqAccess, Visitor},
    ser::{SerializeStruct, Serializer},
    Deserialize, Deserializer, Serialize,
};

/// A converter between a `BTreeMap` or `BTreeMap`-like type and a sequence of named key-value pairs
/// for human-readable encoding formats.
///
/// See [top-level docs](index.html) for example usage.
pub struct BTreeMapToArray<K, V, N = DefaultLabels, T = BTreeMap<K, V>>(PhantomData<(K, V, N, T)>);

impl<K, V, N, T> BTreeMapToArray<K, V, N, T> {
    /// Serializes the given `map` to an array of named key-values if the serializer is
    /// human-readable.  Otherwise serializes the `map` as a map.
    pub fn serialize<'a, S>(map: &'a T, serializer: S) -> Result<S::Ok, S::Error>
    where
        K: 'a + Serialize,
        V: 'a + Serialize,
        N: KeyValueLabels,
        &'a T: IntoIterator<Item = (&'a K, &'a V)> + Serialize,
        S: Serializer,
    {
        serialize::<K, V, N, T, S>(map, serializer)
    }

    /// Deserializes from a serialized array of named key-values into a map if the serializer is
    /// human-readable.  Otherwise deserializes from a serialized map.
    pub fn deserialize<'de, D>(deserializer: D) -> Result<T, D::Error>
    where
        K: Deserialize<'de> + Ord,
        V: Deserialize<'de>,
        N: KeyValueLabels,
        BTreeMap<K, V>: Into<T>,
        T: Deserialize<'de>,
        D: Deserializer<'de>,
    {
        let map = if deserializer.is_human_readable() {
            deserializer.deserialize_seq(BTreeMapToArrayVisitor::<K, V, N>(PhantomData))
        } else {
            BTreeMap::<K, V>::deserialize(deserializer)
        }?;
        Ok(map.into())
    }
}

#[cfg(feature = "json-schema")]
impl<K, V, N, T> JsonSchema for BTreeMapToArray<K, V, N, T>
where
    K: JsonSchema,
    V: JsonSchema,
    N: KeyValueJsonSchema,
{
    fn schema_name() -> String {
        Vec::<KeyValue<K, V, N>>::schema_name()
    }

    fn json_schema(gen: &mut SchemaGenerator) -> Schema {
        Vec::<KeyValue<K, V, N>>::json_schema(gen)
    }
}

fn serialize<'a, K, V, N, T, S>(map: &'a T, serializer: S) -> Result<S::Ok, S::Error>
where
    K: 'a + Serialize,
    V: 'a + Serialize,
    N: KeyValueLabels,
    &'a T: IntoIterator<Item = (&'a K, &'a V)> + Serialize,
    S: Serializer,
{
    if serializer.is_human_readable() {
        serializer.collect_seq(map.into_iter().map(|(key, value)| KeyValue {
            key,
            value,
            _phantom: PhantomData::<N>,
        }))
    } else {
        map.serialize(serializer)
    }
}

/// A specifier of the labels to be used for the keys and values.
pub trait KeyValueLabels {
    /// The label for the keys.
    const KEY: &'static str;
    /// The label for the values.
    const VALUE: &'static str;
}

#[cfg(feature = "json-schema")]
/// A specifier of the JSON schema data to be used for the KeyValue struct.
pub trait KeyValueJsonSchema: KeyValueLabels {
    /// The value to use for `Schemars::schema_name()` of the KeyValue struct.
    ///
    /// If `None`, then a default of `"KeyValue_for_{K::schema_name()}_and_{V::schema_name()}"` is
    /// applied.
    const JSON_SCHEMA_KV_NAME: Option<&'static str> = None;
    /// The description applied to the KeyValue struct.
    const JSON_SCHEMA_KV_DESCRIPTION: Option<&'static str> = None;
    /// The description applied to the key of the KeyValue struct.
    const JSON_SCHEMA_KEY_DESCRIPTION: Option<&'static str> = None;
    /// The description applied to the value of the KeyValue struct.
    const JSON_SCHEMA_VALUE_DESCRIPTION: Option<&'static str> = None;
}

/// A specifier of the default labels to be used for the keys and values.
///
/// This struct implements [`KeyValueLabels`] setting key labels to "key" and value labels to
/// "value".
pub struct DefaultLabels;

impl KeyValueLabels for DefaultLabels {
    const KEY: &'static str = "key";
    const VALUE: &'static str = "value";
}

#[cfg(feature = "json-schema")]
impl KeyValueJsonSchema for DefaultLabels {}

/// A helper to support serialization and deserialization for human-readable encoding formats where
/// the fields `key` and `value` have their labels replaced by the values specified in `N::KEY` and
/// `N::VALUE`.
struct KeyValue<K, V, N> {
    key: K,
    value: V,
    _phantom: PhantomData<N>,
}

impl<K, V, N> Serialize for KeyValue<K, V, N>
where
    K: Serialize,
    V: Serialize,
    N: KeyValueLabels,
{
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("KeyValue", 2)?;
        state.serialize_field(N::KEY, &self.key)?;
        state.serialize_field(N::VALUE, &self.value)?;
        state.end()
    }
}

impl<K, V, N: KeyValueLabels> KeyValue<K, V, N> {
    const FIELDS: &'static [&'static str] = &[N::KEY, N::VALUE];
}

impl<'de, K, V, N> Deserialize<'de> for KeyValue<K, V, N>
where
    K: Deserialize<'de>,
    V: Deserialize<'de>,
    N: KeyValueLabels,
{
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        enum Field<N: KeyValueLabels> {
            Key,
            Value(PhantomData<N>),
        }

        impl<'de, N: KeyValueLabels> Deserialize<'de> for Field<N> {
            fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Field<N>, D::Error> {
                struct FieldVisitor<N>(PhantomData<N>);

                impl<'de, N: KeyValueLabels> Visitor<'de> for FieldVisitor<N> {
                    type Value = Field<N>;

                    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                        write!(formatter, "`{}` or `{}`", N::KEY, N::VALUE)
                    }

                    fn visit_str<E: SerdeError>(self, value: &str) -> Result<Field<N>, E> {
                        if value == N::KEY {
                            Ok(Field::Key)
                        } else if value == N::VALUE {
                            Ok(Field::Value(PhantomData))
                        } else {
                            Err(SerdeError::unknown_field(value, &[N::KEY, N::VALUE]))
                        }
                    }
                }

                deserializer.deserialize_identifier(FieldVisitor(PhantomData))
            }
        }

        struct KvVisitor<K, V, N>(PhantomData<(K, V, N)>);

        impl<'de, K, V, N> Visitor<'de> for KvVisitor<K, V, N>
        where
            K: Deserialize<'de>,
            V: Deserialize<'de>,
            N: KeyValueLabels,
        {
            type Value = KeyValue<K, V, N>;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("struct KeyValue")
            }

            fn visit_seq<SeqA: SeqAccess<'de>>(
                self,
                mut seq: SeqA,
            ) -> Result<KeyValue<K, V, N>, SeqA::Error> {
                let key = seq
                    .next_element()?
                    .ok_or_else(|| SerdeError::invalid_length(0, &self))?;
                let value = seq
                    .next_element()?
                    .ok_or_else(|| SerdeError::invalid_length(1, &self))?;
                Ok(KeyValue {
                    key,
                    value,
                    _phantom: PhantomData,
                })
            }

            fn visit_map<MapA: MapAccess<'de>>(
                self,
                mut map: MapA,
            ) -> Result<KeyValue<K, V, N>, MapA::Error> {
                let mut ret_key = None;
                let mut ret_value = None;
                while let Some(key) = map.next_key::<Field<N>>()? {
                    match key {
                        Field::Key => {
                            if ret_key.is_some() {
                                return Err(SerdeError::duplicate_field(N::KEY));
                            }
                            ret_key = Some(map.next_value()?);
                        }
                        Field::Value(_) => {
                            if ret_value.is_some() {
                                return Err(SerdeError::duplicate_field(N::VALUE));
                            }
                            ret_value = Some(map.next_value()?);
                        }
                    }
                }
                let key = ret_key.ok_or_else(|| SerdeError::missing_field(N::KEY))?;
                let value = ret_value.ok_or_else(|| SerdeError::missing_field(N::VALUE))?;
                Ok(KeyValue {
                    key,
                    value,
                    _phantom: PhantomData,
                })
            }
        }

        deserializer.deserialize_struct("KeyValue", Self::FIELDS, KvVisitor::<_, _, N>(PhantomData))
    }
}

#[cfg(feature = "json-schema")]
impl<K, V, N> JsonSchema for KeyValue<K, V, N>
where
    K: JsonSchema,
    V: JsonSchema,
    N: KeyValueJsonSchema,
{
    fn schema_name() -> String {
        N::JSON_SCHEMA_KV_NAME
            .map(str::to_string)
            .unwrap_or_else(|| {
                format!("KeyValue_for_{}_and_{}", K::schema_name(), V::schema_name())
            })
    }

    fn json_schema(gen: &mut SchemaGenerator) -> Schema {
        let mut schema_object = SchemaObject {
            instance_type: Some(InstanceType::Object.into()),
            ..Default::default()
        };
        let object_validation = schema_object.object();

        let mut key_schema = gen.subschema_for::<K>().into_object();
        key_schema.metadata().description = N::JSON_SCHEMA_KEY_DESCRIPTION.map(str::to_string);
        object_validation
            .properties
            .insert(N::KEY.to_string(), key_schema.into());
        object_validation.required.insert(N::KEY.to_string());

        let mut value_schema = gen.subschema_for::<V>().into_object();
        value_schema.metadata().description = N::JSON_SCHEMA_VALUE_DESCRIPTION.map(str::to_string);
        object_validation
            .properties
            .insert(N::VALUE.to_string(), value_schema.into());
        object_validation.required.insert(N::VALUE.to_string());

        schema_object.metadata().description = N::JSON_SCHEMA_KV_DESCRIPTION.map(str::to_string);
        schema_object.into()
    }
}

struct BTreeMapToArrayVisitor<K, V, N>(PhantomData<(K, V, N)>);

impl<'de, K, V, N> Visitor<'de> for BTreeMapToArrayVisitor<K, V, N>
where
    K: Deserialize<'de> + Ord,
    V: Deserialize<'de>,
    N: KeyValueLabels,
{
    type Value = BTreeMap<K, V>;

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("a BTreeMapToArray")
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Self::Value, A::Error> {
        let mut map = BTreeMap::new();
        while let Some(entry) = seq.next_element::<KeyValue<K, V, N>>()? {
            map.insert(entry.key, entry.value);
        }
        Ok(map)
    }
}

/// A converter between a `HashMap` or `HashMap`-like type and a sequence of named key-value pairs
/// for human-readable encoding formats.
///
/// See [top-level docs](index.html) for example usage.
#[cfg(feature = "std")]
pub struct HashMapToArray<K, V, N = DefaultLabels, U = RandomState, T = HashMap<K, V, U>>(
    PhantomData<(K, V, N, U, T)>,
);

#[cfg(feature = "std")]
impl<K, V, N, U, T> HashMapToArray<K, V, N, U, T> {
    /// Serializes the given `map` to an array of named key-values if the serializer is
    /// human-readable.  Otherwise serializes the `map` as a map.
    pub fn serialize<'a, S>(map: &'a T, serializer: S) -> Result<S::Ok, S::Error>
    where
        K: 'a + Serialize,
        V: 'a + Serialize,
        N: KeyValueLabels,
        &'a T: IntoIterator<Item = (&'a K, &'a V)> + Serialize,
        S: Serializer,
    {
        serialize::<K, V, N, T, S>(map, serializer)
    }

    /// Deserializes from a serialized array of named key-values into a map if the serializer is
    /// human-readable.  Otherwise deserializes from a serialized map.
    pub fn deserialize<'de, D>(deserializer: D) -> Result<T, D::Error>
    where
        K: Deserialize<'de> + Eq + Hash,
        V: Deserialize<'de>,
        N: KeyValueLabels,
        U: BuildHasher + Default,
        HashMap<K, V, U>: Into<T>,
        T: Deserialize<'de>,
        D: Deserializer<'de>,
    {
        let map = if deserializer.is_human_readable() {
            deserializer.deserialize_seq(HashMapToArrayVisitor::<K, V, N, U>(PhantomData))
        } else {
            HashMap::<K, V, U>::deserialize(deserializer)
        }?;
        Ok(map.into())
    }
}

#[cfg(feature = "json-schema")]
impl<K, V, N, U, T> JsonSchema for HashMapToArray<K, V, N, U, T>
where
    K: JsonSchema,
    V: JsonSchema,
    N: KeyValueJsonSchema,
{
    fn schema_name() -> String {
        Vec::<KeyValue<K, V, N>>::schema_name()
    }

    fn json_schema(gen: &mut SchemaGenerator) -> Schema {
        Vec::<KeyValue<K, V, N>>::json_schema(gen)
    }
}

#[cfg(feature = "std")]
struct HashMapToArrayVisitor<K, V, N, U>(PhantomData<(K, V, N, U)>);

#[cfg(feature = "std")]
impl<'de, K, V, N, U> Visitor<'de> for HashMapToArrayVisitor<K, V, N, U>
where
    K: Deserialize<'de> + Eq + Hash,
    V: Deserialize<'de>,
    N: KeyValueLabels,
    U: BuildHasher + Default,
{
    type Value = HashMap<K, V, U>;

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("a HashMapToArray")
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Self::Value, A::Error> {
        let mut map = HashMap::<K, V, U>::default();
        while let Some(entry) = seq.next_element::<KeyValue<K, V, N>>()? {
            map.insert(entry.key, entry.value);
        }
        Ok(map)
    }
}
