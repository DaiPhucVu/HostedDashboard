import re
from typing import Iterable, Set


CATEGORY_SKILL_ALIASES = {
    "plumbing": {
        "plumbing", "plumber", "pipe_fitting", "faucet_repair", "drain_repair",
    },
    "electrical": {"electrical", "electrician", "wiring", "socket_repair"},
    "cleaning": {"cleaning", "cleaner", "deep_cleaning", "house_cleaning"},
    "appliance_repair": {
        "appliance_repair", "fridge_repair", "refrigerator_repair",
        "washing_machine_repair", "oven_repair",
    },
    "painting": {"painting", "painter", "wall_painting", "renovation"},
    "ac_repair": {
        "ac_repair", "air_conditioning", "hvac", "air_conditioner_repair",
    },
    "beauty_wellness": {
        "beauty_wellness", "beautician", "makeup", "makeup_artist", "facial",
        "spa", "skincare", "massage", "wellness",
    },
    "shifting": {"shifting", "house_moving", "moving", "packing", "mover"},
    "mens_care_salon": {
        "mens_care_salon", "barber", "mens_haircut", "haircut", "shaving",
        "grooming",
    },
    "health_care": {
        "health_care", "caregiver", "home_care", "patient_care", "elderly_care",
        "nursing",
    },
    "electronics_repair": {
        "electronics_repair", "gadget_repair", "phone_repair", "mobile_repair",
        "laptop_repair",
    },
    "pest_control": {
        "pest_control", "cockroach_control", "termite_control", "rodent_control",
        "bed_bug_control",
    },
    "driver_service": {"driver_service", "driver", "personal_driver", "chauffeur"},
    "car_care": {"car_care", "car_wash", "car_mechanic", "vehicle_service"},
    "trips_travel": {"trips_travel", "travel_planning", "tour_guide", "travel_agent"},
    "car_rental": {"car_rental", "vehicle_rental", "rent_a_car"},
    "emergency_service": {"emergency_service", "emergency_response", "urgent_assistance"},
}


def normalise_skill(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").casefold()).strip("_")


def provider_skill_categories(skills: Iterable[str]) -> Set[str]:
    normalised = {normalise_skill(skill) for skill in skills}
    return {
        category
        for category, aliases in CATEGORY_SKILL_ALIASES.items()
        if normalised.intersection(aliases)
    }


def provider_has_required_skills(
    provider_skills: Iterable[str],
    required_skills: Iterable[str],
) -> bool:
    provider_values = {normalise_skill(skill) for skill in provider_skills}
    provider_categories = provider_skill_categories(provider_values)
    for required in required_skills:
        required_value = normalise_skill(required)
        if required_value in CATEGORY_SKILL_ALIASES:
            if required_value not in provider_categories:
                return False
        elif required_value not in provider_values:
            return False
    return True


def provider_skill_match_score(
    job_text: str,
    provider_skills: Iterable[str],
    required_skills: Iterable[str],
) -> float:
    if not provider_has_required_skills(provider_skills, required_skills):
        return 0.0

    normalised_job = "_" + normalise_skill(job_text) + "_"
    required = {normalise_skill(skill) for skill in required_skills}
    provider_values = {normalise_skill(skill) for skill in provider_skills}
    specialties = provider_values - required
    if any("_" + skill + "_" in normalised_job for skill in specialties if skill):
        return 1.0
    return 0.8
