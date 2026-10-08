"""Where the kosher restaurant directory looks, and what it calls things.

Shared by the import scripts and the /restaurants API, so a city or a
category is spelled one way everywhere.
"""
import re

# What people search for, and the words Google is given for it.
CATEGORIES = {
    "pizza": "pizza",
    "burgers": "burgers",
    "meat_grill": "meat grill restaurant",
    "sushi_asian": "sushi asian restaurant",
    "cafe": "cafe",
    "bakery": "bakery",
    "dairy_italian": "dairy italian restaurant",
    "dessert": "dessert ice cream",
    "shawarma_falafel": "shawarma falafel",
    "hummus": "hummus",
    "deli": "deli",
    "breakfast": "israeli breakfast",
    "fish": "fish seafood restaurant",
    "steakhouse": "steakhouse",
}

# Google's own type for a place decides its category when it has one: the
# search a place turned up in is a weak signal ("kosher burgers" also
# returns the taco place next door). The search word is the fallback.
TYPE_TO_CATEGORY = {
    "pizza_restaurant": "pizza", "hamburger_restaurant": "burgers",
    "barbecue_restaurant": "meat_grill", "steak_house": "steakhouse",
    "sushi_restaurant": "sushi_asian", "japanese_restaurant": "sushi_asian",
    "asian_restaurant": "sushi_asian", "chinese_restaurant": "sushi_asian",
    "thai_restaurant": "sushi_asian", "ramen_restaurant": "sushi_asian",
    "cafe": "cafe", "coffee_shop": "cafe", "bakery": "bakery",
    "italian_restaurant": "dairy_italian", "ice_cream_shop": "dessert",
    "dessert_shop": "dessert", "dessert_restaurant": "dessert", "confectionery": "dessert",
    "deli": "deli", "breakfast_restaurant": "breakfast", "brunch_restaurant": "breakfast",
    "seafood_restaurant": "fish", "falafel_restaurant": "shawarma_falafel",
    "kebab_shop": "shawarma_falafel", "hummus_restaurant": "hummus",
}

# Big cities are searched per neighbourhood as well, because one search
# stops at 60 results and Jerusalem has far more than 60 kosher cafes.
NEIGHBOURHOODS = {
    "Jerusalem": ["City Center", "Mahane Yehuda", "German Colony", "Baka", "Talpiot", "Rehavia",
                  "Geula", "Mea Shearim", "Ramot", "Har Nof", "Givat Shaul", "Ramat Eshkol",
                  "Pisgat Zeev", "Kiryat Yovel", "Malha", "Old City", "Katamon", "French Hill",
                  "Gilo", "Mamilla"],
    "Tel Aviv-Yafo": ["Old North", "Florentin", "Neve Tzedek", "Jaffa", "Ramat Aviv", "Sarona",
                      "Dizengoff", "Rothschild", "Kerem HaTeimanim", "Tel Aviv Port", "Bavli",
                      "Yad Eliyahu"],
    "Haifa": ["Carmel Center", "Downtown Haifa", "German Colony", "Hadar", "Neve Shaanan", "Ahuza",
              "Bat Galim", "Kiryat Haim"],
    "Beit Shemesh": ["Ramat Beit Shemesh Aleph", "Ramat Beit Shemesh Bet", "Ramat Beit Shemesh Gimmel",
                     "Old Beit Shemesh", "Nofei Aviv", "Mishkafayim"],
    "Bnei Brak": ["Rabbi Akiva Street", "Kiryat Herzog", "Pardes Katz", "Ramat Elchanan", "Vizhnitz"],
}

# Every city, with its region. Order is the run order.
CITIES = {
    "Jerusalem": "Jerusalem", "Tel Aviv-Yafo": "Tel Aviv", "Haifa": "Haifa",
    "Beit Shemesh": "Jerusalem", "Ramat Gan": "Tel Aviv", "Bnei Brak": "Tel Aviv",
    "Petah Tikva": "Center", "Netanya": "Center", "Ashdod": "South", "Ashkelon": "South",
    "Rishon LeZion": "Center", "Holon": "Tel Aviv", "Bat Yam": "Tel Aviv", "Rehovot": "Center",
    "Modiin": "Center", "Modiin Illit": "Judea & Samaria", "Beitar Illit": "Judea & Samaria",
    "Efrat": "Judea & Samaria", "Ma'ale Adumim": "Judea & Samaria", "Kfar Saba": "Center",
    "Ra'anana": "Center", "Herzliya": "Tel Aviv", "Hod HaSharon": "Center", "Givatayim": "Tel Aviv",
    "Kiryat Ono": "Tel Aviv", "Lod": "Center", "Ramla": "Center", "Be'er Sheva": "South",
    "Eilat": "South", "Tiberias": "North", "Tzfat": "North", "Kiryat Gat": "South",
    "Kiryat Shmona": "North", "Afula": "North", "Nof HaGalil": "North", "Karmiel": "North",
    "Akko": "North", "Nahariya": "North", "Hadera": "Haifa", "Zichron Yaakov": "Haifa",
    "Caesarea": "Haifa", "Arad": "South", "Dimona": "South", "Yeruham": "South",
    "Mitzpe Ramon": "South", "Elad": "Center", "Ariel": "Judea & Samaria",
    "Kiryat Arba": "Judea & Samaria", "Hebron": "Judea & Samaria", "Katzrin": "North",
    "Dead Sea": "South",
}

# URL names for the city pages (/restaurants/tel-aviv). Everything else is
# the city name lower-cased with spaces as dashes.
SLUG_OVERRIDES = {"Tel Aviv-Yafo": "tel-aviv", "Nof HaGalil": "nof-hagalil"}


def city_slug(city):
    return SLUG_OVERRIDES.get(city) or re.sub(r"[^a-z0-9]+", "-", city.lower().replace("'", "")).strip("-")


SLUG_TO_CITY = {city_slug(c): c for c in CITIES}

REGIONS = ["North", "Haifa", "Center", "Tel Aviv", "Jerusalem", "South", "Judea & Samaria"]

CITY_HE = {
    "Jerusalem": "ירושלים", "Tel Aviv-Yafo": "תל אביב-יפו", "Haifa": "חיפה", "Beit Shemesh": "בית שמש",
    "Ramat Gan": "רמת גן", "Bnei Brak": "בני ברק", "Petah Tikva": "פתח תקווה", "Netanya": "נתניה",
    "Ashdod": "אשדוד", "Ashkelon": "אשקלון", "Rishon LeZion": "ראשון לציון", "Holon": "חולון",
    "Bat Yam": "בת ים", "Rehovot": "רחובות", "Modiin": "מודיעין", "Modiin Illit": "מודיעין עילית",
    "Beitar Illit": "ביתר עילית", "Efrat": "אפרת", "Ma'ale Adumim": "מעלה אדומים", "Kfar Saba": "כפר סבא",
    "Ra'anana": "רעננה", "Herzliya": "הרצליה", "Hod HaSharon": "הוד השרון", "Givatayim": "גבעתיים",
    "Kiryat Ono": "קריית אונו", "Lod": "לוד", "Ramla": "רמלה", "Be'er Sheva": "באר שבע", "Eilat": "אילת",
    "Tiberias": "טבריה", "Tzfat": "צפת", "Kiryat Gat": "קריית גת", "Kiryat Shmona": "קריית שמונה",
    "Afula": "עפולה", "Nof HaGalil": "נוף הגליל", "Karmiel": "כרמיאל", "Akko": "עכו", "Nahariya": "נהריה",
    "Hadera": "חדרה", "Zichron Yaakov": "זכרון יעקב", "Caesarea": "קיסריה", "Arad": "ערד", "Dimona": "דימונה",
    "Yeruham": "ירוחם", "Mitzpe Ramon": "מצפה רמון", "Elad": "אלעד", "Ariel": "אריאל", "Kiryat Arba": "קריית ארבע",
    "Hebron": "חברון", "Katzrin": "קצרין", "Dead Sea": "ים המלח",
}
