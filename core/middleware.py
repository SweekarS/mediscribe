"""
Custom middleware for MediScribe.
"""


class ElectronCORSMiddleware:
    """
    Handles CORS for the Electron desktop app which sends Origin: null
    (because it loads pages from file:// protocol).

    django-cors-headers does not support null origins, so this middleware
    adds the necessary headers when the request comes from the desktop app.

    Must be placed AFTER CorsMiddleware in MIDDLEWARE so it can patch
    responses that CorsMiddleware skipped.
    """

    ELECTRON_HEADER = "X-Electron-App"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        origin = request.META.get("HTTP_ORIGIN", "")

        if origin == "null" or request.META.get(f"HTTP_{self.ELECTRON_HEADER.upper().replace('-', '_')}"):
            response["Access-Control-Allow-Origin"] = "null"
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Electron-App"
            response["Access-Control-Allow-Credentials"] = "true"

        return response
