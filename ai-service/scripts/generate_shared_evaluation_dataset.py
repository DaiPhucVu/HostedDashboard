import json
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "fixtures" / "firebase_shared_eval_v2"
DATASET_VERSION = "firebase-shared-eval-v2-100"
SOURCE_TYPE = "SYNTHETIC_TEST_DATA"

FIRST_NAMES = (
    "Aarav", "Aditi", "Adnan", "Afrin", "Ahsan", "Akash", "Anika", "Arif",
    "Farhan", "Farzana", "Hasan", "Ishrat", "Jamal", "Jannat", "Kabir",
    "Karim", "Lamia", "Mahin", "Maya", "Mehedi", "Nadia", "Nafis", "Nayeem",
    "Nusrat", "Rafi", "Rahim", "Raisa", "Rashed", "Rima", "Rony", "Sabina",
    "Sadia", "Sakib", "Salma", "Shafiq", "Shila", "Sohan", "Sumaiya", "Tanvir",
    "Tania",
)
LAST_NAMES = (
    "Ahmed", "Akter", "Ali", "Begum", "Chowdhury", "Haque", "Hasan", "Hossain",
    "Islam", "Jahan", "Khan", "Mahmud", "Miah", "Molla", "Nahar", "Rahman",
    "Roy", "Sarkar", "Siddique", "Sultana", "Uddin", "Zaman", "Das", "Kabir",
    "Karim",
)

AREAS = (
    ("Gulshan", 23.7925, 90.4078),
    ("Banani", 23.7937, 90.4066),
    ("Dhanmondi", 23.7461, 90.3742),
    ("Uttara", 23.8759, 90.3795),
    ("Mirpur", 23.8223, 90.3654),
    ("Mohammadpur", 23.7588, 90.3630),
    ("Badda", 23.7806, 90.4267),
    ("Tejgaon", 23.7630, 90.4010),
)

SPECIALTIES = {
    "plumbing": ("pipe repair", "faucet repair", "drain cleaning", "toilet repair", "water line repair"),
    "electrical": ("wiring", "socket repair", "lighting", "circuit breaker", "fan installation"),
    "cleaning": ("deep cleaning", "home cleaning", "office cleaning", "bathroom cleaning", "carpet cleaning"),
    "appliance_repair": ("washing machine repair", "fridge repair", "oven repair", "microwave repair", "water heater repair"),
    "painting": ("interior painting", "exterior painting", "wall painting", "plastering", "home renovation"),
    "ac_repair": ("ac servicing", "ac cleaning", "ac installation", "ac gas refill", "air conditioner repair"),
    "beauty_wellness": ("facial", "makeup", "skincare", "massage", "manicure", "pedicure"),
    "shifting": ("packing", "house moving", "furniture moving", "office relocation", "loading and unloading"),
    "mens_care_salon": ("mens haircut", "beard trim", "shaving", "mens grooming", "mens hair styling"),
    "health_care": ("elderly care", "patient care", "home nursing", "physiotherapy", "disability care"),
    "electronics_repair": ("phone repair", "laptop repair", "computer repair", "tv repair", "screen replacement"),
    "pest_control": ("cockroach control", "termite control", "rodent control", "bed bug control", "fumigation"),
    "driver_service": ("personal driver", "chauffeur", "family driver", "designated driver"),
    "car_care": ("vehicle service", "oil change", "tyre service", "battery service", "car detailing"),
    "trips_travel": ("travel planning", "tour guide", "trip booking", "ticket booking", "hotel booking"),
    "car_rental": ("vehicle rental", "self drive rental", "car hire", "family car rental"),
    "emergency_service": ("roadside assistance", "urgent assistance", "emergency response", "immediate help"),
}

HISTORY_DESCRIPTIONS = {
    "plumbing": "Repaired a leaking kitchen pipe and tested the water line.",
    "electrical": "Diagnosed a socket fault and replaced damaged wiring.",
    "cleaning": "Completed a deep clean of a two-bedroom apartment.",
    "appliance_repair": "Diagnosed and repaired a washing machine drainage fault.",
    "painting": "Prepared and painted interior bedroom walls.",
    "ac_repair": "Serviced an air conditioner and restored normal cooling.",
    "beauty_wellness": "Provided a booked facial and skincare service.",
    "shifting": "Packed and moved household furniture to a new apartment.",
    "mens_care_salon": "Provided a haircut and beard trim appointment.",
    "health_care": "Provided scheduled daytime elderly home care.",
    "electronics_repair": "Diagnosed and repaired a laptop startup fault.",
    "pest_control": "Completed a kitchen cockroach control treatment.",
    "driver_service": "Completed a scheduled family driving service.",
    "car_care": "Completed a vehicle service and engine oil change.",
    "trips_travel": "Planned and booked a three-day family trip.",
    "car_rental": "Completed a one-day five-seat vehicle rental.",
    "emergency_service": "Provided urgent roadside assistance.",
}

CERTIFICATES = {
    "health_care": "Caregiving Training Certificate",
    "driver_service": "Professional Driving Licence",
    "car_rental": "Commercial Vehicle Permit",
    "beauty_wellness": "Beauty Therapy Certificate",
    "mens_care_salon": "Salon Skills Certificate",
    "trips_travel": "Tour Operations Certificate",
    "emergency_service": "Emergency Response Certificate",
}

PROFILE_COUNTS = (18, 10, 7, 4, 12, 3)
PROFILE_CANCELLATIONS = (0, 1, 0, 0, 1, 0)
PROFILE_ACTIVE = (0, 1, 1, 0, 2, 0)
PROFILE_CAPACITY = (4, 4, 3, 3, 4, 2)
PROFILE_YEARS = (14, 9, 7, 4, 11, 3)
PROFILE_RADIUS = (24, 20, 18, 16, 22, 15)


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def iso(day, hour=9):
    return datetime(
        day.year,
        day.month,
        day.day,
        hour,
        tzinfo=timezone.utc,
    ).isoformat().replace("+00:00", "Z")


def provider_count(category_index):
    return 6 if category_index < 15 else 5


def boundary_state(category_index):
    states = ("pending", "unavailable", "at_capacity", "outside_centre")
    return states[category_index % len(states)]


def rating_for(provider_index, completed_index):
    if provider_index == 0:
        return 5 if completed_index % 5 else 4
    if provider_index in (1, 2):
        return 5 if completed_index % 3 == 0 else 4
    if provider_index == 3:
        return 4 if completed_index % 4 else 5
    return 4 if completed_index % 3 else 3


def build_provider(category, item, category_index, provider_index, global_index):
    provider_id = f"eval-v2-{category}-{provider_index + 1:02d}"
    area, base_latitude, base_longitude = AREAS[(category_index + provider_index) % len(AREAS)]
    latitude = round(base_latitude + (provider_index % 3) * 0.0007, 6)
    longitude = round(base_longitude - (provider_index % 2) * 0.0006, 6)
    state = "eligible"
    if provider_index == 5 or (provider_index == 4 and provider_count(category_index) == 5):
        state = boundary_state(category_index)
    available = state != "unavailable"
    verification = "pending" if state == "pending" else "approved"
    active_jobs = PROFILE_ACTIVE[provider_index]
    capacity = PROFILE_CAPACITY[provider_index]
    if state == "at_capacity":
        active_jobs = capacity
    if state == "outside_centre":
        latitude, longitude = 24.1583, 90.6667
    specialties = SPECIALTIES[category]
    selected_specialties = [
        specialties[provider_index % len(specialties)],
        specialties[(provider_index + 2) % len(specialties)],
    ]
    first_name = FIRST_NAMES[(global_index * 7) % len(FIRST_NAMES)]
    last_name = LAST_NAMES[(global_index * 11) % len(LAST_NAMES)]
    provider = {
        "handymanId": provider_id,
        "firstName": first_name,
        "lastName": last_name,
        "email": f"{provider_id}@example.test",
        "verificationStatus": verification,
        "verified": verification == "approved",
        "available": available,
        "availabilityStatus": "available" if available else "unavailable",
        "primaryTrade": item["labelEn"],
        "skills": [category, *selected_specialties],
        "experienceYears": str(PROFILE_YEARS[provider_index]),
        "hourlyRate": str(450 + category_index * 25 + provider_index * 40),
        "latitude": latitude,
        "longitude": longitude,
        "serviceRadiusKm": PROFILE_RADIUS[provider_index],
        "maxConcurrentJobs": capacity,
        "medianResponseMinutes": 12 + provider_index * 7,
        "area": area,
        "city": "Dhaka",
        "district": "Dhaka",
        "country": "Bangladesh",
        "languages": ["Bangla", "English"],
        "bio": (
            f"{item['labelEn']} provider serving {area} and nearby Dhaka areas. "
            f"Experienced in {selected_specialties[0]} and {selected_specialties[1]}."
        ),
        "certificateType1": CERTIFICATES.get(category, "Trade Skills Certificate"),
        "certificateApprovedStatus": "approved" if verification == "approved" else "pending",
        "createdAt": "2024-01-15T09:00:00Z",
        "updatedAt": "2026-09-20T09:00:00Z",
        "testData": True,
        "sourceType": SOURCE_TYPE,
        "datasetVersion": DATASET_VERSION,
        "datasetProfile": state,
    }
    return provider_id, provider, active_jobs


def build():
    taxonomy = json.loads(
        (ROOT / "taxonomy" / "service_taxonomy.json").read_text(encoding="utf-8")
    )
    providers = {}
    jobs = {}
    reviews = {}
    cases = []
    provider_counts = Counter()
    eligible_counts = Counter()
    baseline = date(2026, 9, 20)
    global_index = 0

    for category_index, item in enumerate(taxonomy["categories"]):
        category = item["id"]
        category_provider_ids = []
        for provider_index in range(provider_count(category_index)):
            provider_id, provider, active_count = build_provider(
                category,
                item,
                category_index,
                provider_index,
                global_index,
            )
            global_index += 1
            providers[provider_id] = provider
            category_provider_ids.append(provider_id)
            provider_counts[category] += 1
            if provider["verified"] and provider["available"] and active_count < provider["maxConcurrentJobs"]:
                eligible_counts[category] += 1

            completed_count = PROFILE_COUNTS[provider_index]
            for completed_index in range(completed_count):
                completed_day = baseline - timedelta(days=20 + category_index * 2 + completed_index * 5)
                job_id = f"eval-v2-history-{category}-{provider_index + 1:02d}-{completed_index + 1:02d}"
                review_id = f"eval-v2-review-{category}-{provider_index + 1:02d}-{completed_index + 1:02d}"
                jobs[job_id] = {
                    "jobId": job_id,
                    "jobCat": item["labelEn"],
                    "jobDesc": HISTORY_DESCRIPTIONS[category],
                    "jobLocation": f"{provider['area']}, Dhaka",
                    "latitude": provider["latitude"],
                    "longitude": provider["longitude"],
                    "jobDateFrom": str(completed_day),
                    "jobDateTo": str(completed_day),
                    "jobTimeFrom": "09:00",
                    "jobTimeTo": "14:00",
                    "jobSalaryFrom": 800,
                    "jobSalaryTo": 1800,
                    "jobStatus": "Done",
                    "assignedTo": provider_id,
                    "createdAt": iso(completed_day - timedelta(days=3)),
                    "completedAt": iso(completed_day, 15),
                    "testData": True,
                    "sourceType": SOURCE_TYPE,
                    "datasetVersion": DATASET_VERSION,
                    "datasetRecordType": "PROVIDER_HISTORY",
                }
                provider.setdefault("evaluationJobs", {})[job_id] = job_id
                provider.setdefault("evaluationCompletedJobs", {})[job_id] = job_id
                reviews[review_id] = {
                    "reviewId": review_id,
                    "jobId": job_id,
                    "handymanId": provider_id,
                    "reviewerType": "customer",
                    "rating": rating_for(provider_index, completed_index),
                    "comment": "Synthetic evaluation review linked to a completed job.",
                    "createdAt": iso(completed_day, 16),
                    "testData": True,
                    "sourceType": SOURCE_TYPE,
                    "datasetVersion": DATASET_VERSION,
                }

            for cancelled_index in range(PROFILE_CANCELLATIONS[provider_index]):
                cancelled_day = baseline - timedelta(days=12 + category_index + cancelled_index)
                job_id = f"eval-v2-cancelled-{category}-{provider_index + 1:02d}-{cancelled_index + 1:02d}"
                jobs[job_id] = {
                    "jobId": job_id,
                    "jobCat": item["labelEn"],
                    "jobDesc": HISTORY_DESCRIPTIONS[category],
                    "jobLocation": f"{provider['area']}, Dhaka",
                    "jobStatus": "Cancelled",
                    "assignedTo": provider_id,
                    "cancelledByType": "provider",
                    "createdAt": iso(cancelled_day - timedelta(days=2)),
                    "cancelledAt": iso(cancelled_day),
                    "testData": True,
                    "sourceType": SOURCE_TYPE,
                    "datasetVersion": DATASET_VERSION,
                    "datasetRecordType": "PROVIDER_HISTORY",
                }
                provider.setdefault("evaluationJobs", {})[job_id] = job_id
                provider.setdefault("evaluationCancelledJobs", {})[job_id] = job_id

            for active_index in range(active_count):
                active_day = baseline + timedelta(days=10 + active_index)
                job_id = f"eval-v2-active-{category}-{provider_index + 1:02d}-{active_index + 1:02d}"
                jobs[job_id] = {
                    "jobId": job_id,
                    "jobCat": item["labelEn"],
                    "jobDesc": HISTORY_DESCRIPTIONS[category],
                    "jobLocation": f"{provider['area']}, Dhaka",
                    "jobDateFrom": str(active_day),
                    "jobDateTo": str(active_day),
                    "jobTimeFrom": "10:00",
                    "jobTimeTo": "15:00",
                    "jobStatus": "In Progress",
                    "assignedTo": provider_id,
                    "createdAt": iso(baseline - timedelta(days=2)),
                    "testData": True,
                    "sourceType": SOURCE_TYPE,
                    "datasetVersion": DATASET_VERSION,
                    "datasetRecordType": "PROVIDER_HISTORY",
                }
                provider.setdefault("evaluationJobs", {})[job_id] = job_id
                provider.setdefault("evaluationActiveJobs", {})[job_id] = job_id

        cases.extend((
            {
                "caseId": f"eval-v2-case-{category}-broad",
                "categoryId": category,
                "job": {
                    "jobId": f"eval-v2-case-{category}-broad",
                    "description": f"I need help with {item['labelEn'].lower()}.",
                    "categoryHint": category,
                    "locationText": "Gulshan, Dhaka",
                    "latitude": 23.7925,
                    "longitude": 90.4078,
                    "startAt": "2026-10-10",
                    "endAt": "2026-10-10",
                },
                "expectedCategoryId": category,
                "expectedCandidateMinimum": 4,
                "expectedRelevantProviderIds": category_provider_ids,
            },
            {
                "caseId": f"eval-v2-case-{category}-specific",
                "categoryId": category,
                "job": {
                    "jobId": f"eval-v2-case-{category}-specific",
                    "description": HISTORY_DESCRIPTIONS[category],
                    "categoryHint": category,
                    "locationText": "Gulshan, Dhaka",
                    "latitude": 23.7925,
                    "longitude": 90.4078,
                    "startAt": "2026-10-11",
                    "endAt": "2026-10-11",
                },
                "expectedCategoryId": category,
                "expectedCandidateMinimum": 4,
                "expectedRelevantProviderIds": category_provider_ids,
            },
        ))

    manifest = {
        "datasetVersion": DATASET_VERSION,
        "sourceType": SOURCE_TYPE,
        "purpose": "Shared Firebase provider coverage and assignment evaluation",
        "generatedAt": "2026-10-04T00:00:00Z",
        "taxonomyVersion": taxonomy["version"],
        "providerCount": len(providers),
        "historyJobCount": len(jobs),
        "reviewCount": len(reviews),
        "evaluationCaseCount": len(cases),
        "serviceFamilies": [item["id"] for item in taxonomy["categories"]],
        "providersPerFamily": dict(sorted(provider_counts.items())),
        "minimumEligibleProvidersPerFamily": min(eligible_counts.values()),
        "eligibleProvidersPerFamily": dict(sorted(eligible_counts.items())),
        "firebaseNodes": ["Handyman", "EvaluationJobHistory", "Reviews", "TestDatasets"],
        "safety": "All records are synthetic, version tagged, collision checked, and removable by dataset version.",
    }
    export = {
        "Handyman": providers,
        "EvaluationJobHistory": jobs,
        "Reviews": reviews,
        "TestDatasets": {
            DATASET_VERSION: manifest,
        },
    }

    OUTPUT.mkdir(parents=True, exist_ok=True)
    write_json(OUTPUT / "manifest.json", manifest)
    write_json(OUTPUT / "firebase-export.json", export)
    write_json(OUTPUT / "evaluation-cases.json", cases)


if __name__ == "__main__":
    build()
