import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence


class ContractError(ValueError):
    pass


def load_schema(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _matches_type(value: Any, expected: str) -> bool:
    if expected == "null":
        return value is None
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    return True


def validate(value: Any, schema: Dict[str, Any], path: str = "$") -> None:
    if "enum" in schema and value not in schema["enum"]:
        raise ContractError("{} must be one of {}".format(path, schema["enum"]))

    expected = schema.get("type")
    if expected:
        expected_types = expected if isinstance(expected, list) else [expected]
        if not any(_matches_type(value, item) for item in expected_types):
            raise ContractError("{} has invalid type; expected {}".format(path, expected_types))

    if isinstance(value, dict):
        required = schema.get("required", [])
        missing = [name for name in required if name not in value]
        if missing:
            raise ContractError("{} missing required fields {}".format(path, missing))
        properties = schema.get("properties", {})
        if schema.get("additionalProperties") is False:
            extras = sorted(set(value) - set(properties))
            if extras:
                raise ContractError("{} has additional fields {}".format(path, extras))
        for name, item in value.items():
            if name in properties:
                validate(item, properties[name], "{}.{}".format(path, name))

    if isinstance(value, list) and "items" in schema:
        for index, item in enumerate(value):
            validate(item, schema["items"], "{}[{}]".format(path, index))

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            raise ContractError("{} is below minimum".format(path))
        if "maximum" in schema and value > schema["maximum"]:
            raise ContractError("{} is above maximum".format(path))
        if "exclusiveMinimum" in schema and value <= schema["exclusiveMinimum"]:
            raise ContractError("{} must exceed exclusive minimum".format(path))

    if isinstance(value, str) and "minLength" in schema and len(value) < schema["minLength"]:
        raise ContractError("{} is shorter than minLength".format(path))

    if isinstance(value, list) and schema.get("uniqueItems"):
        if len({json.dumps(item, sort_keys=True) for item in value}) != len(value):
            raise ContractError("{} must contain unique items".format(path))
