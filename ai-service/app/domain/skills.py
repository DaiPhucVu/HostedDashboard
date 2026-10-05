import re
from typing import Iterable, Set


CATEGORY_SKILL_ALIASES = {
    "plumbing": {
        "plumbing", "plumber", "pipe_fitting", "pipe_repair", "faucet_repair",
        "tap_repair", "drain_repair", "drain_cleaning", "toilet_repair",
        "sink_repair", "leak_repair", "bathroom_plumbing", "water_line_repair",
    },
    "electrical": {
        "electrical", "electrician", "wiring", "socket_repair", "outlet_repair",
        "switch_repair", "lighting", "light_installation", "circuit_breaker",
        "fan_installation", "electrical_installation", "power_fault",
    },
    "cleaning": {
        "cleaning", "cleaner", "deep_cleaning", "house_cleaning", "home_cleaning",
        "office_cleaning", "kitchen_cleaning", "bathroom_cleaning", "carpet_cleaning",
        "window_cleaning", "move_out_cleaning",
    },
    "appliance_repair": {
        "appliance_repair", "fridge_repair", "refrigerator_repair",
        "washing_machine_repair", "oven_repair", "microwave_repair",
        "dishwasher_repair", "dryer_repair", "freezer_repair", "cooker_repair",
        "water_heater_repair",
    },
    "painting": {
        "painting", "painter", "wall_painting", "house_painting", "interior_painting",
        "exterior_painting", "renovation", "home_renovation", "wallpaper",
        "plastering",
    },
    "ac_repair": {
        "ac_repair", "air_conditioning", "hvac", "air_conditioner_repair",
        "ac_installation", "ac_servicing", "ac_cleaning", "ac_gas_refill",
    },
    "beauty_wellness": {
        "beauty_wellness", "beautician", "makeup", "makeup_artist", "facial",
        "spa", "skincare", "massage", "wellness", "manicure", "pedicure",
        "waxing", "beauty_treatment", "hair_styling",
    },
    "shifting": {
        "shifting", "house_moving", "home_moving", "moving", "packing", "mover",
        "furniture_moving", "office_relocation", "loading", "unloading",
    },
    "mens_care_salon": {
        "mens_care_salon", "barber", "mens_haircut", "haircut", "shaving",
        "grooming", "beard_trim", "mens_grooming", "mens_hair_styling",
        "salon_service",
    },
    "health_care": {
        "health_care", "caregiver", "home_care", "patient_care", "elderly_care",
        "nursing", "home_nursing", "physiotherapy", "disability_care",
    },
    "electronics_repair": {
        "electronics_repair", "gadget_repair", "phone_repair", "mobile_repair",
        "laptop_repair", "computer_repair", "tablet_repair", "tv_repair",
        "screen_replacement", "device_repair",
    },
    "pest_control": {
        "pest_control", "cockroach_control", "termite_control", "rodent_control",
        "rat_control", "bed_bug_control", "mosquito_control", "fumigation",
    },
    "driver_service": {
        "driver_service", "driver", "personal_driver", "chauffeur", "driving_service",
        "designated_driver",
    },
    "car_care": {
        "car_care", "car_wash", "car_mechanic", "vehicle_service", "vehicle_repair",
        "car_repair", "oil_change", "tyre_service", "tire_service", "battery_service",
        "car_detailing",
    },
    "trips_travel": {
        "trips_travel", "travel_planning", "tour_guide", "travel_agent", "trip_booking",
        "tour_package", "ticket_booking", "hotel_booking",
    },
    "car_rental": {
        "car_rental", "vehicle_rental", "rent_a_car", "hire_a_car", "car_hire",
        "self_drive_rental",
    },
    "emergency_service": {
        "emergency_service", "emergency_response", "urgent_assistance", "immediate_help",
        "roadside_assistance",
    },
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
