import json
from collections import Counter
from datetime import date, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "fixtures" / "emulator_v1"

DETAILS = {
    "plumbing": ("repair a leaking kitchen pipe", "রান্নাঘরের লিক করা পাইপ মেরামত", "kitchen pipe leak repair"),
    "electrical": ("repair a sparking wall socket", "স্পার্ক করা দেয়ালের সকেট মেরামত", "wall socket spark repair"),
    "cleaning": ("deep clean a two-bedroom apartment", "দুই বেডরুমের বাসা গভীরভাবে পরিষ্কার", "two bedroom basha deep clean"),
    "appliance_repair": ("repair a washing machine that will not drain", "পানি বের না হওয়া ওয়াশিং মেশিন মেরামত", "washing machine drain hocche na"),
    "painting": ("paint two interior bedroom walls", "দুটি বেডরুমের ভেতরের দেয়াল রং", "bedroom wall rong korte hobe"),
    "ac_repair": ("service an air conditioner that is not cooling", "ঠান্ডা না হওয়া এসি সার্ভিস", "AC thanda hocche na"),
    "beauty_wellness": ("provide a facial and skincare service", "ফেসিয়াল ও ত্বকের যত্ন সেবা", "facial and skincare service dorkar"),
    "shifting": ("pack and move furniture to a new apartment", "আসবাবপত্র প্যাক করে নতুন বাসায় নেওয়া", "furniture pack kore new basha shift"),
    "mens_care_salon": ("provide a haircut and beard trim", "চুল কাটা ও দাড়ি ট্রিম", "haircut and beard trim dorkar"),
    "health_care": ("provide daytime elderly home care", "দিনের বেলা বয়স্ক ব্যক্তির বাড়িতে পরিচর্যা", "daytime elderly home care dorkar"),
    "electronics_repair": ("repair a laptop that will not start", "চালু না হওয়া ল্যাপটপ মেরামত", "laptop start hocche na"),
    "pest_control": ("treat a cockroach problem in the kitchen", "রান্নাঘরের তেলাপোকা নিয়ন্ত্রণ", "kitchen cockroach control dorkar"),
    "driver_service": ("drive a family to appointments for one day", "এক দিনের জন্য পরিবারকে বিভিন্ন স্থানে নিয়ে যাওয়া", "one day family driver dorkar"),
    "car_care": ("service a car and replace the engine oil", "গাড়ি সার্ভিস ও ইঞ্জিন অয়েল পরিবর্তন", "car service and oil change dorkar"),
    "trips_travel": ("plan a three-day family trip", "তিন দিনের পারিবারিক ভ্রমণ পরিকল্পনা", "three day family trip plan dorkar"),
    "car_rental": ("rent a five-seat car for one day", "এক দিনের জন্য পাঁচ আসনের গাড়ি ভাড়া", "one day five seat car vara dorkar"),
    "emergency_service": ("provide immediate roadside assistance", "এখনই রাস্তার পাশে জরুরি সহায়তা", "urgent roadside help dorkar"),
}

SPECIALTIES = {
    "plumbing": "pipe repair",
    "electrical": "socket repair",
    "cleaning": "deep cleaning",
    "appliance_repair": "washing machine repair",
    "painting": "interior painting",
    "ac_repair": "ac servicing",
    "beauty_wellness": "facial",
    "shifting": "packing and moving",
    "mens_care_salon": "haircut",
    "health_care": "elderly care",
    "electronics_repair": "laptop repair",
    "pest_control": "cockroach control",
    "driver_service": "personal driver",
    "car_care": "vehicle service",
    "trips_travel": "travel planning",
    "car_rental": "vehicle rental",
    "emergency_service": "roadside assistance",
}


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def language_mix(index):
    if index < 6:
        return ("en", "en", "en", "bn", "bn", "mixed")
    if index < 12:
        return ("en", "en", "bn", "bn", "bn", "mixed")
    return ("en", "en", "bn", "bn", "mixed", "mixed")


def description_for(category, label_en, label_bn, language, variant):
    detail_en, detail_bn, detail_mixed = DETAILS[category]
    urgent = variant == 2
    if language == "en":
        if variant == 0:
            return f"I need {label_en.lower()} service at my home."
        return f"{'Urgent: ' if urgent else ''}Please {detail_en}."
    if language == "bn":
        if variant == 0:
            return f"আমার {label_bn} সেবা দরকার।"
        return f"{'জরুরি: ' if urgent else ''}{detail_bn} করতে হবে।"
    if variant == 0:
        return f"{label_en} er jonno worker dorkar."
    return f"{'Urgent: ' if urgent else ''}{detail_mixed}."


def build():
    taxonomy = json.loads(
        (ROOT / "taxonomy" / "service_taxonomy.json").read_text(encoding="utf-8")
    )
    providers = {}
    jobs = {}
    reviews = {}
    users = {
        f"eval-customer-{index:02d}": {
            "userId": f"eval-customer-{index:02d}",
            "firstName": "Evaluation",
            "lastName": f"Customer {index:02d}",
            "email": f"eval-customer-{index:02d}@example.test",
            "status": "active",
        }
        for index in range(1, 7)
    }
    labels = []
    today = date(2026, 9, 10)

    for category_index, item in enumerate(taxonomy["categories"]):
        category = item["id"]
        expected_providers = []
        for provider_index, profile in enumerate(("experienced", "developing"), start=1):
            provider_id = f"eval-{category}-{provider_index:02d}"
            expected_providers.append(provider_id)
            completed_count = 8 if profile == "experienced" else 3
            latitude = round(23.7800 + category_index * 0.001 + provider_index * 0.0002, 6)
            longitude = round(90.4050 + category_index * 0.0007 + provider_index * 0.0002, 6)
            providers[provider_id] = {
                "handymanId": provider_id,
                "firstName": item["labelEn"].split()[0],
                "lastName": "Specialist" if profile == "experienced" else "Associate",
                "verificationStatus": "approved",
                "available": True,
                "availabilityStatus": "available",
                "primaryTrade": item["labelEn"],
                "skills": [category, SPECIALTIES[category]],
                "experienceYears": 10 if profile == "experienced" else 4,
                "latitude": latitude,
                "longitude": longitude,
                "serviceRadiusKm": 20,
                "maxConcurrentJobs": 3,
                "languages": ["bn", "en"],
                "bio": f"Verified {item['labelEn'].lower()} provider for evaluation.",
            }
            for completed_index in range(completed_count):
                job_id = f"history-{category}-{provider_index:02d}-{completed_index + 1:02d}"
                jobs[job_id] = {
                    "jobId": job_id,
                    "jobCat": item["labelEn"],
                    "jobDesc": DETAILS[category][0].capitalize() + ".",
                    "jobLocation": "Gulshan, Dhaka",
                    "jobDateFrom": str(today - timedelta(days=90 + completed_index)),
                    "jobDateTo": str(today - timedelta(days=90 + completed_index)),
                    "jobTimeFrom": "10:00",
                    "jobTimeTo": "14:00",
                    "jobStatus": "Done",
                    "assignedTo": provider_id,
                    "createdAt": f"2026-06-{(completed_index % 28) + 1:02d}T08:00:00.000Z",
                }
                providers[provider_id].setdefault("allJobs", {})[job_id] = job_id
                providers[provider_id].setdefault("completedJobs", {})[job_id] = job_id
                review_id = f"review-{category}-{provider_index:02d}-{completed_index + 1:02d}"
                reviews[review_id] = {
                    "reviewId": review_id,
                    "jobId": job_id,
                    "handymanId": provider_id,
                    "reviewerType": "customer",
                    "rating": 5 if profile == "experienced" and completed_index % 3 else 4,
                    "createdAt": f"2026-06-{(completed_index % 28) + 1:02d}T16:00:00.000Z",
                }
            if profile == "developing":
                active_id = f"active-{category}-{provider_index:02d}"
                jobs[active_id] = {
                    "jobId": active_id,
                    "jobCat": item["labelEn"],
                    "jobDesc": DETAILS[category][0].capitalize() + ".",
                    "jobLocation": "Gulshan, Dhaka",
                    "jobDateFrom": str(today + timedelta(days=2)),
                    "jobDateTo": str(today + timedelta(days=2)),
                    "jobTimeFrom": "10:00",
                    "jobTimeTo": "14:00",
                    "jobStatus": "Offered",
                    "assignedTo": provider_id,
                    "createdAt": "2026-09-01T08:00:00.000Z",
                }
                providers[provider_id].setdefault("allJobs", {})[active_id] = active_id

        languages = language_mix(category_index)
        language_variants = Counter()
        for case_index, language in enumerate(languages):
            variant = language_variants[language]
            language_variants[language] += 1
            job_id = f"case-{category}-{case_index + 1:02d}"
            missing_location = case_index == 5 and category_index % 4 == 0
            missing_schedule = case_index == 4 and category_index % 4 == 1
            job = {
                "jobId": job_id,
                "jobCat": item["labelEn"],
                "jobDesc": description_for(
                    category,
                    item["labelEn"],
                    item["labelBn"],
                    language,
                    variant,
                ),
                "jobLocation": "" if missing_location else "Gulshan, Dhaka",
                "latitude": None if missing_location else 23.7925,
                "longitude": None if missing_location else 90.4078,
                "jobDateFrom": "" if missing_schedule else str(today + timedelta(days=case_index + 1)),
                "jobDateTo": "" if missing_schedule else str(today + timedelta(days=case_index + 1)),
                "jobTimeFrom": "10:00",
                "jobTimeTo": "15:00",
                "jobSalaryFrom": 800,
                "jobSalaryTo": 1800,
                "jobStatus": "Open",
                "createdAt": f"2026-09-{(case_index % 9) + 1:02d}T09:00:00.000Z",
                "customerId": f"eval-customer-{(case_index % 6) + 1:02d}",
            }
            jobs[job_id] = job
            users[job["customerId"]].setdefault("allJobs", {})[job_id] = job_id
            users[job["customerId"]].setdefault("notAssignedJobs", {})[job_id] = job_id
            missing_fields = []
            if missing_location:
                missing_fields.append("location")
            if missing_schedule:
                missing_fields.append("schedule")
            labels.append({
                "jobId": job_id,
                "sourceType": "SYNTHETIC_REVIEWED_CASE",
                "language": language,
                "caseType": "incomplete" if missing_fields else ("broad" if variant == 0 else "specific"),
                "expectedCategoryId": category,
                "expectedUrgency": "HIGH" if variant == 2 else "NORMAL",
                "expectedTriageStatus": "NEEDS_INFO" if missing_fields else "READY_FOR_ASSIGNMENT",
                "expectedMissingFields": missing_fields,
                "relevantProviderIds": expected_providers,
                "labelStatus": "REQUIRES_TWO_REVIEWERS",
            })

    negative_profiles = {
        "eval-negative-unverified": {"verificationStatus": "pending", "available": True},
        "eval-negative-unavailable": {"verificationStatus": "approved", "available": False},
        "eval-negative-distant": {"verificationStatus": "approved", "available": True},
    }
    for provider_id, fields in negative_profiles.items():
        providers[provider_id] = {
            "handymanId": provider_id,
            "firstName": "Negative",
            "lastName": provider_id.split("-")[-1].title(),
            "primaryTrade": "Plumbing",
            "skills": ["plumbing"],
            "experienceYears": 6,
            "latitude": 24.50 if provider_id.endswith("distant") else 23.7925,
            "longitude": 91.00 if provider_id.endswith("distant") else 90.4078,
            "serviceRadiusKm": 10,
            "maxConcurrentJobs": 2,
            "availabilityStatus": "available" if fields["available"] else "unavailable",
            **fields,
        }

    language_counts = Counter(label["language"] for label in labels)
    manifest = {
        "datasetVersion": "firebase-emulator-v1",
        "sourceType": "SYNTHETIC_REVIEWED_TEST_DATA",
        "purpose": "Offline triage, ranking, and automatic-assignment evaluation only",
        "sharedFirebaseSafe": False,
        "taxonomyVersion": taxonomy["version"],
        "providerCount": len(providers),
        "completeEligibleProviderCount": len(taxonomy["categories"]) * 2,
        "labelledJobCount": len(labels),
        "languageCounts": dict(sorted(language_counts.items())),
        "serviceFamilies": [item["id"] for item in taxonomy["categories"]],
        "labelPolicy": "Expected labels are independent of model and ranker output; two human reviewers must approve them before release gating.",
    }
    firebase_export = {
        "admin": {
            "eval-admin": {
                "email": "admin@example.com",
                "password": "admin123",
                "firstName": "Evaluation",
                "lastName": "Admin",
                "role": "admin",
                "status": "active"
            }
        },
        "Handyman": providers,
        "Job": jobs,
        "Reviews": reviews,
        "Settings": {
            "jobAssignment": {
                "mode": "MANUAL",
                "enabledAt": None,
                "updatedAt": "2026-09-10T00:00:00.000Z",
                "updatedBy": "dataset-generator",
            }
        },
        "User": users,
    }

    OUTPUT.mkdir(parents=True, exist_ok=True)
    write_json(OUTPUT / "manifest.json", manifest)
    write_json(OUTPUT / "firebase-export.json", firebase_export)
    write_json(OUTPUT / "labels.json", labels)


if __name__ == "__main__":
    build()
