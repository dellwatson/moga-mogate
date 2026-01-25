use alloc::{
    collections::{btree_map, BTreeMap},
    string::{String, ToString},
    vec::Vec,
};
use core::fmt::Debug;

#[cfg(feature = "json-schema")]
use schemars::{schema_for, JsonSchema};
use serde::{Deserialize, Serialize};

#[cfg(feature = "json-schema")]
use super::KeyValueJsonSchema;
use super::{BTreeMapToArray, KeyValueLabels};

struct MyKeyValueLabels;

impl KeyValueLabels for MyKeyValueLabels {
    const KEY: &'static str = "id";
    const VALUE: &'static str = "label";
}

#[cfg(feature = "json-schema")]
impl KeyValueJsonSchema for MyKeyValueLabels {
    const JSON_SCHEMA_KV_NAME: Option<&'static str> = Some("my_map");
    const JSON_SCHEMA_KV_DESCRIPTION: Option<&'static str> = Some("Labels indexed by ID.");
    const JSON_SCHEMA_KEY_DESCRIPTION: Option<&'static str> = Some("The identifier.");
    const JSON_SCHEMA_VALUE_DESCRIPTION: Option<&'static str> = Some("The label.");
}

#[derive(Debug, Eq, PartialEq, Serialize, Deserialize)]
struct KeyValue {
    key: u64,
    value: String,
}

#[derive(Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
struct ConvertedData {
    inner: Vec<KeyValue>,
}

#[derive(Debug, Eq, PartialEq, Serialize, Deserialize)]
struct IdLabel {
    id: u64,
    label: String,
}

#[derive(Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
struct ConvertedCustomLabels {
    inner: Vec<IdLabel>,
}

#[track_caller]
fn check_bincode<T>(input: &T, expected_serialized: Vec<u8>)
where
    T: Serialize + for<'d> Deserialize<'d> + PartialEq + Debug,
{
    let serialized = bincode::serialize(input).unwrap();
    assert_eq!(serialized, expected_serialized);
    let deserialized: T = bincode::deserialize(&serialized).unwrap();
    assert_eq!(*input, deserialized);
}

#[track_caller]
fn check_json<T>(input: &T, expected_encoded: &str)
where
    T: Serialize + for<'d> Deserialize<'d> + PartialEq + Debug,
{
    let encoded = serde_json::to_string(input).unwrap();
    assert_eq!(encoded, expected_encoded);
    let parsed: T = serde_json::from_str(&encoded).unwrap();
    assert_eq!(*input, parsed);
}

#[track_caller]
fn check_toml<T>(input: &T, expected_encoded: &str)
where
    T: Serialize + for<'d> Deserialize<'d> + PartialEq + Debug,
{
    let encoded = toml::to_string(input).unwrap();
    assert_eq!(encoded, expected_encoded);
    let parsed: T = toml::from_str(&encoded).unwrap();
    assert_eq!(*input, parsed);
}

#[cfg(feature = "json-schema")]
#[track_caller]
fn check_json_schema<T: JsonSchema>(expected_schema: &str) {
    let actual_schema = serde_json::to_string_pretty(&schema_for!(T)).unwrap();
    assert_eq!(
        actual_schema, expected_schema,
        "Actual schema:\n{}\nExpected schema:\n{}\n",
        actual_schema, expected_schema,
    );
}

mod btreemap {
    use super::*;

    #[derive(Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
    #[cfg_attr(feature = "json-schema", derive(JsonSchema))]
    struct Data {
        #[serde(with = "BTreeMapToArray::<u64, String>")]
        inner: BTreeMap<u64, String>,
    }

    #[derive(Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
    #[cfg_attr(feature = "json-schema", derive(JsonSchema))]
    struct CustomLabels {
        #[serde(with = "BTreeMapToArray::<u64, String, MyKeyValueLabels>")]
        inner: BTreeMap<u64, String>,
    }

    #[derive(Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
    struct NewtypeMap(BTreeMap<u64, String>);

    /// We need to implement `IntoIterator` to allow serialization.
    impl<'a> IntoIterator for &'a NewtypeMap {
        type Item = (&'a u64, &'a String);
        type IntoIter = btree_map::Iter<'a, u64, String>;

        fn into_iter(self) -> Self::IntoIter {
            self.0.iter()
        }
    }

    /// We need to implement `From<BTreeMap>` to allow deserialization.
    impl From<BTreeMap<u64, String>> for NewtypeMap {
        fn from(map: BTreeMap<u64, String>) -> Self {
            NewtypeMap(map)
        }
    }

    #[derive(Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
    #[cfg_attr(feature = "json-schema", derive(JsonSchema))]
    struct CustomMapAndLabels {
        #[serde(with = "BTreeMapToArray::<u64, String, MyKeyValueLabels, NewtypeMap>")]
        inner: NewtypeMap,
    }

    #[derive(Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
    struct UnmappedData {
        inner: BTreeMap<u64, String>,
    }

    impl From<&Data> for ConvertedData {
        fn from(data: &Data) -> Self {
            ConvertedData {
                inner: data
                    .inner
                    .iter()
                    .map(|(key, value)| KeyValue {
                        key: *key,
                        value: value.clone(),
                    })
                    .collect(),
            }
        }
    }

    impl From<&CustomLabels> for ConvertedCustomLabels {
        fn from(custom_labels: &CustomLabels) -> Self {
            ConvertedCustomLabels {
                inner: custom_labels
                    .inner
                    .iter()
                    .map(|(key, value)| IdLabel {
                        id: *key,
                        label: value.clone(),
                    })
                    .collect(),
            }
        }
    }

    fn init_map() -> BTreeMap<u64, String> {
        let mut map = BTreeMap::new();
        map.insert(1, "one".to_string());
        map.insert(2, "two".to_string());
        map
    }

    #[test]
    fn should_encode_with_default_labels() {
        let data = Data { inner: init_map() };
        let unmapped_data = UnmappedData { inner: init_map() };

        let expected_bincode = bincode::serialize(&unmapped_data).unwrap();
        check_bincode(&data, expected_bincode);

        let expected_json = r#"{"inner":[{"key":1,"value":"one"},{"key":2,"value":"two"}]}"#;
        check_json(&data, expected_json);

        let expected_toml = r#"[[inner]]
key = 1
value = "one"

[[inner]]
key = 2
value = "two"
"#;
        check_toml(&data, expected_toml);
    }

    #[test]
    fn should_encode_with_custom_labels() {
        let custom_labels = CustomLabels { inner: init_map() };
        let unmapped_data = UnmappedData { inner: init_map() };

        let expected_bincode = bincode::serialize(&unmapped_data).unwrap();
        check_bincode(&custom_labels, expected_bincode);

        let expected_json = r#"{"inner":[{"id":1,"label":"one"},{"id":2,"label":"two"}]}"#;
        check_json(&custom_labels, expected_json);

        let expected_toml = r#"[[inner]]
id = 1
label = "one"

[[inner]]
id = 2
label = "two"
"#;
        check_toml(&custom_labels, expected_toml);
    }

    #[test]
    fn should_encode_with_custom_map_and_labels() {
        let custom_map_and_labels = CustomMapAndLabels {
            inner: NewtypeMap(init_map()),
        };
        let unmapped_data = UnmappedData { inner: init_map() };

        let expected_bincode = bincode::serialize(&unmapped_data).unwrap();
        check_bincode(&custom_map_and_labels, expected_bincode);

        let expected_json = r#"{"inner":[{"id":1,"label":"one"},{"id":2,"label":"two"}]}"#;
        check_json(&custom_map_and_labels, expected_json);

        let expected_toml = r#"[[inner]]
id = 1
label = "one"

[[inner]]
id = 2
label = "two"
"#;
        check_toml(&custom_map_and_labels, expected_toml);
    }

    #[test]
    fn should_encode_empty_map() {
        let data = Data::default();
        let custom_labels = CustomLabels::default();
        let unmapped_data = UnmappedData::default();

        let expected_bincode = bincode::serialize(&unmapped_data).unwrap();
        check_bincode(&data, expected_bincode.clone());
        check_bincode(&custom_labels, expected_bincode);

        let expected_json = r#"{"inner":[]}"#;
        check_json(&data, expected_json);
        check_json(&custom_labels, expected_json);

        let expected_toml = "inner = []\n";
        check_toml(&data, expected_toml);
        check_toml(&custom_labels, expected_toml);
    }

    #[test]
    fn encoded_json_should_be_equivalent_to_mapped_types() {
        let data = Data { inner: init_map() };
        let encoded = serde_json::to_string(&data).unwrap();
        let converted = ConvertedData::from(&data);
        let encoded_converted = serde_json::to_string(&converted).unwrap();
        assert_eq!(encoded, encoded_converted);

        let custom_labels = CustomLabels { inner: init_map() };
        let encoded = serde_json::to_string(&custom_labels).unwrap();
        let converted = ConvertedCustomLabels::from(&custom_labels);
        let encoded_converted = serde_json::to_string(&converted).unwrap();
        assert_eq!(encoded, encoded_converted);
    }

    #[test]
    fn encoded_toml_should_be_equivalent_to_mapped_types() {
        let data = Data { inner: init_map() };
        let encoded = toml::to_string(&data).unwrap();
        let converted = ConvertedData::from(&data);
        let encoded_converted = toml::to_string(&converted).unwrap();
        assert_eq!(encoded, encoded_converted);

        let custom_labels = CustomLabels { inner: init_map() };
        let encoded = toml::to_string(&custom_labels).unwrap();
        let converted = ConvertedCustomLabels::from(&custom_labels);
        let encoded_converted = toml::to_string(&converted).unwrap();
        assert_eq!(encoded, encoded_converted);
    }

    #[cfg(feature = "json-schema")]
    #[test]
    fn should_produce_expected_json_schema() {
        check_json_schema::<Data>(
            r##"{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Data",
  "type": "object",
  "required": [
    "inner"
  ],
  "properties": {
    "inner": {
      "$ref": "#/definitions/Array_of_KeyValue_for_uint64_and_String"
    }
  },
  "definitions": {
    "Array_of_KeyValue_for_uint64_and_String": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/KeyValue_for_uint64_and_String"
      }
    },
    "KeyValue_for_uint64_and_String": {
      "type": "object",
      "required": [
        "key",
        "value"
      ],
      "properties": {
        "key": {
          "type": "integer",
          "format": "uint64",
          "minimum": 0.0
        },
        "value": {
          "type": "string"
        }
      }
    }
  }
}"##,
        );

        check_json_schema::<CustomLabels>(
            r##"{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CustomLabels",
  "type": "object",
  "required": [
    "inner"
  ],
  "properties": {
    "inner": {
      "$ref": "#/definitions/Array_of_my_map"
    }
  },
  "definitions": {
    "Array_of_my_map": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/my_map"
      }
    },
    "my_map": {
      "description": "Labels indexed by ID.",
      "type": "object",
      "required": [
        "id",
        "label"
      ],
      "properties": {
        "id": {
          "description": "The identifier.",
          "type": "integer",
          "format": "uint64",
          "minimum": 0.0
        },
        "label": {
          "description": "The label.",
          "type": "string"
        }
      }
    }
  }
}"##,
        );

        check_json_schema::<CustomMapAndLabels>(
            r##"{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CustomMapAndLabels",
  "type": "object",
  "required": [
    "inner"
  ],
  "properties": {
    "inner": {
      "$ref": "#/definitions/Array_of_my_map"
    }
  },
  "definitions": {
    "Array_of_my_map": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/my_map"
      }
    },
    "my_map": {
      "description": "Labels indexed by ID.",
      "type": "object",
      "required": [
        "id",
        "label"
      ],
      "properties": {
        "id": {
          "description": "The identifier.",
          "type": "integer",
          "format": "uint64",
          "minimum": 0.0
        },
        "label": {
          "description": "The label.",
          "type": "string"
        }
      }
    }
  }
}"##,
        );
    }
}

#[cfg(feature = "std")]
mod hashmap {
    use std::collections::{
        hash_map::{self, RandomState},
        HashMap,
    };

    use hash_hasher::HashBuildHasher;

    use super::*;
    use crate::{DefaultLabels, HashMapToArray};

    #[derive(Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
    #[cfg_attr(feature = "json-schema", derive(JsonSchema))]
    struct Data {
        #[serde(with = "HashMapToArray::<u64, String>")]
        inner: HashMap<u64, String>,
    }

    #[derive(Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
    #[cfg_attr(feature = "json-schema", derive(JsonSchema))]
    struct CustomLabels {
        #[serde(with = "HashMapToArray::<u64, String, MyKeyValueLabels>")]
        inner: HashMap<u64, String>,
    }

    #[derive(Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
    #[cfg_attr(feature = "json-schema", derive(JsonSchema))]
    struct CustomHasher {
        #[serde(with = "HashMapToArray::<u64, String, DefaultLabels, HashBuildHasher>")]
        inner: HashMap<u64, String, HashBuildHasher>,
    }

    #[derive(Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
    struct UnmappedData {
        inner: HashMap<u64, String>,
    }

    #[derive(Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
    struct UnmappedCustomHasher {
        inner: HashMap<u64, String, HashBuildHasher>,
    }

    #[derive(Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
    struct NewtypeMap(HashMap<u64, String>);

    /// We need to implement `IntoIterator` to allow serialization.
    impl<'a> IntoIterator for &'a NewtypeMap {
        type Item = (&'a u64, &'a String);
        type IntoIter = hash_map::Iter<'a, u64, String>;

        fn into_iter(self) -> Self::IntoIter {
            self.0.iter()
        }
    }

    /// We need to implement `From<HashMap>` to allow deserialization.
    impl From<HashMap<u64, String>> for NewtypeMap {
        fn from(map: HashMap<u64, String>) -> Self {
            NewtypeMap(map)
        }
    }

    #[derive(Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
    #[cfg_attr(feature = "json-schema", derive(JsonSchema))]
    struct CustomMapAndLabels {
        #[serde(with = "HashMapToArray::<u64, String, MyKeyValueLabels, RandomState, NewtypeMap>")]
        inner: NewtypeMap,
    }

    impl From<&Data> for ConvertedData {
        fn from(data: &Data) -> Self {
            ConvertedData {
                inner: data
                    .inner
                    .iter()
                    .map(|(key, value)| KeyValue {
                        key: *key,
                        value: value.clone(),
                    })
                    .collect(),
            }
        }
    }

    impl From<&CustomLabels> for ConvertedCustomLabels {
        fn from(custom_labels: &CustomLabels) -> Self {
            ConvertedCustomLabels {
                inner: custom_labels
                    .inner
                    .iter()
                    .map(|(key, value)| IdLabel {
                        id: *key,
                        label: value.clone(),
                    })
                    .collect(),
            }
        }
    }

    fn init_map() -> HashMap<u64, String> {
        let mut map = HashMap::new();
        map.insert(1, "one".to_string());
        map.insert(2, "two".to_string());
        map
    }

    #[test]
    fn should_encode_with_default_labels() {
        let data = Data { inner: init_map() };
        let unmapped_data = UnmappedData {
            inner: data.inner.clone(),
        };

        let expected_bincode = bincode::serialize(&unmapped_data).unwrap();
        check_bincode(&data, expected_bincode);

        let expected_json = if *data.inner.keys().next().unwrap() == 1 {
            r#"{"inner":[{"key":1,"value":"one"},{"key":2,"value":"two"}]}"#
        } else {
            r#"{"inner":[{"key":2,"value":"two"},{"key":1,"value":"one"}]}"#
        };

        check_json(&data, expected_json);

        let expected_toml = if *data.inner.keys().next().unwrap() == 1 {
            r#"[[inner]]
key = 1
value = "one"

[[inner]]
key = 2
value = "two"
"#
        } else {
            r#"[[inner]]
key = 2
value = "two"

[[inner]]
key = 1
value = "one"
"#
        };
        check_toml(&data, expected_toml);
    }

    #[test]
    fn should_encode_with_custom_labels() {
        let custom_labels = CustomLabels { inner: init_map() };
        let unmapped_data = UnmappedData {
            inner: custom_labels.inner.clone(),
        };

        let expected_bincode = bincode::serialize(&unmapped_data).unwrap();
        check_bincode(&custom_labels, expected_bincode);

        let expected_json = if *custom_labels.inner.keys().next().unwrap() == 1 {
            r#"{"inner":[{"id":1,"label":"one"},{"id":2,"label":"two"}]}"#
        } else {
            r#"{"inner":[{"id":2,"label":"two"},{"id":1,"label":"one"}]}"#
        };
        check_json(&custom_labels, expected_json);

        let expected_toml = if *custom_labels.inner.keys().next().unwrap() == 1 {
            r#"[[inner]]
id = 1
label = "one"

[[inner]]
id = 2
label = "two"
"#
        } else {
            r#"[[inner]]
id = 2
label = "two"

[[inner]]
id = 1
label = "one"
"#
        };
        check_toml(&custom_labels, expected_toml);
    }

    #[test]
    fn should_encode_with_custom_hasher() {
        let custom_hasher = CustomHasher {
            inner: init_map().into_iter().collect(),
        };
        let unmapped_data = UnmappedCustomHasher {
            inner: custom_hasher.inner.clone(),
        };

        let expected_bincode = bincode::serialize(&unmapped_data).unwrap();
        check_bincode(&custom_hasher, expected_bincode);

        let expected_json = if *custom_hasher.inner.keys().next().unwrap() == 1 {
            r#"{"inner":[{"key":1,"value":"one"},{"key":2,"value":"two"}]}"#
        } else {
            r#"{"inner":[{"key":2,"value":"two"},{"key":1,"value":"one"}]}"#
        };

        check_json(&custom_hasher, expected_json);

        let expected_toml = if *custom_hasher.inner.keys().next().unwrap() == 1 {
            r#"[[inner]]
key = 1
value = "one"

[[inner]]
key = 2
value = "two"
"#
        } else {
            r#"[[inner]]
key = 2
value = "two"

[[inner]]
key = 1
value = "one"
"#
        };
        check_toml(&custom_hasher, expected_toml);
    }

    #[test]
    fn should_encode_with_custom_map_and_labels() {
        let custom_map_and_labels = CustomMapAndLabels {
            inner: NewtypeMap(init_map()),
        };
        let unmapped_data = UnmappedData {
            inner: custom_map_and_labels.inner.0.clone(),
        };

        let expected_bincode = bincode::serialize(&unmapped_data).unwrap();
        check_bincode(&custom_map_and_labels, expected_bincode);

        let expected_json = if *custom_map_and_labels.inner.0.keys().next().unwrap() == 1 {
            r#"{"inner":[{"id":1,"label":"one"},{"id":2,"label":"two"}]}"#
        } else {
            r#"{"inner":[{"id":2,"label":"two"},{"id":1,"label":"one"}]}"#
        };
        check_json(&custom_map_and_labels, expected_json);

        let expected_toml = if *custom_map_and_labels.inner.0.keys().next().unwrap() == 1 {
            r#"[[inner]]
id = 1
label = "one"

[[inner]]
id = 2
label = "two"
"#
        } else {
            r#"[[inner]]
id = 2
label = "two"

[[inner]]
id = 1
label = "one"
"#
        };
        check_toml(&custom_map_and_labels, expected_toml);
    }

    #[test]
    fn should_encode_empty_map() {
        let data = Data::default();
        let custom_labels = CustomLabels::default();
        let unmapped_data = UnmappedData::default();

        let expected_bincode = bincode::serialize(&unmapped_data).unwrap();
        check_bincode(&data, expected_bincode.clone());
        check_bincode(&custom_labels, expected_bincode);

        let expected_json = r#"{"inner":[]}"#;
        check_json(&data, expected_json);
        check_json(&custom_labels, expected_json);

        let expected_toml = "inner = []\n";
        check_toml(&data, expected_toml);
        check_toml(&custom_labels, expected_toml);
    }

    #[test]
    fn encoded_json_should_be_equivalent_to_mapped_types() {
        let data = Data { inner: init_map() };
        let encoded = serde_json::to_string(&data).unwrap();
        let converted = ConvertedData::from(&data);
        let encoded_converted = serde_json::to_string(&converted).unwrap();
        assert_eq!(encoded, encoded_converted);

        let custom_labels = CustomLabels { inner: init_map() };
        let encoded = serde_json::to_string(&custom_labels).unwrap();
        let converted = ConvertedCustomLabels::from(&custom_labels);
        let encoded_converted = serde_json::to_string(&converted).unwrap();
        assert_eq!(encoded, encoded_converted);
    }

    #[test]
    fn encoded_toml_should_be_equivalent_to_mapped_types() {
        let data = Data { inner: init_map() };
        let encoded = toml::to_string(&data).unwrap();
        let converted = ConvertedData::from(&data);
        let encoded_converted = toml::to_string(&converted).unwrap();
        assert_eq!(encoded, encoded_converted);

        let custom_labels = CustomLabels { inner: init_map() };
        let encoded = toml::to_string(&custom_labels).unwrap();
        let converted = ConvertedCustomLabels::from(&custom_labels);
        let encoded_converted = toml::to_string(&converted).unwrap();
        assert_eq!(encoded, encoded_converted);
    }

    #[cfg(feature = "json-schema")]
    #[test]
    fn should_produce_expected_json_schema() {
        check_json_schema::<Data>(
            r##"{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Data",
  "type": "object",
  "required": [
    "inner"
  ],
  "properties": {
    "inner": {
      "$ref": "#/definitions/Array_of_KeyValue_for_uint64_and_String"
    }
  },
  "definitions": {
    "Array_of_KeyValue_for_uint64_and_String": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/KeyValue_for_uint64_and_String"
      }
    },
    "KeyValue_for_uint64_and_String": {
      "type": "object",
      "required": [
        "key",
        "value"
      ],
      "properties": {
        "key": {
          "type": "integer",
          "format": "uint64",
          "minimum": 0.0
        },
        "value": {
          "type": "string"
        }
      }
    }
  }
}"##,
        );

        check_json_schema::<CustomLabels>(
            r##"{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CustomLabels",
  "type": "object",
  "required": [
    "inner"
  ],
  "properties": {
    "inner": {
      "$ref": "#/definitions/Array_of_my_map"
    }
  },
  "definitions": {
    "Array_of_my_map": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/my_map"
      }
    },
    "my_map": {
      "description": "Labels indexed by ID.",
      "type": "object",
      "required": [
        "id",
        "label"
      ],
      "properties": {
        "id": {
          "description": "The identifier.",
          "type": "integer",
          "format": "uint64",
          "minimum": 0.0
        },
        "label": {
          "description": "The label.",
          "type": "string"
        }
      }
    }
  }
}"##,
        );

        check_json_schema::<CustomHasher>(
            r##"{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CustomHasher",
  "type": "object",
  "required": [
    "inner"
  ],
  "properties": {
    "inner": {
      "$ref": "#/definitions/Array_of_KeyValue_for_uint64_and_String"
    }
  },
  "definitions": {
    "Array_of_KeyValue_for_uint64_and_String": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/KeyValue_for_uint64_and_String"
      }
    },
    "KeyValue_for_uint64_and_String": {
      "type": "object",
      "required": [
        "key",
        "value"
      ],
      "properties": {
        "key": {
          "type": "integer",
          "format": "uint64",
          "minimum": 0.0
        },
        "value": {
          "type": "string"
        }
      }
    }
  }
}"##,
        );

        check_json_schema::<CustomMapAndLabels>(
            r##"{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CustomMapAndLabels",
  "type": "object",
  "required": [
    "inner"
  ],
  "properties": {
    "inner": {
      "$ref": "#/definitions/Array_of_my_map"
    }
  },
  "definitions": {
    "Array_of_my_map": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/my_map"
      }
    },
    "my_map": {
      "description": "Labels indexed by ID.",
      "type": "object",
      "required": [
        "id",
        "label"
      ],
      "properties": {
        "id": {
          "description": "The identifier.",
          "type": "integer",
          "format": "uint64",
          "minimum": 0.0
        },
        "label": {
          "description": "The label.",
          "type": "string"
        }
      }
    }
  }
}"##,
        );
    }
}
