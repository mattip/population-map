"""ITM (Israeli Transverse Mercator, EPSG:2039) -> WGS84 lon/lat.

Self-contained so the build has no compiled dependencies.
Grid definition (EPSG:2039, Israel 1993 / Israeli TM Grid):
    +proj=tmerc +lat_0=31.73439361111111 +lon_0=35.20451694444445
    +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80
    +towgs84=-48,55,52,0,0,0,0
"""
import math

# GRS80
A = 6378137.0
F_INV = 298.257222101
F = 1.0 / F_INV
E2 = 2 * F - F * F

LAT0 = math.radians(31.734393611111111)
LON0 = math.radians(35.204516944444445)
K0 = 1.0000067
X0 = 219529.584
Y0 = 626907.390

# Israel 1993 -> WGS84 geocentric translation (metres)
DX, DY, DZ = -48.0, 55.0, 52.0


def _meridian_arc(lat):
    """Distance along the meridian from the equator, GRS80."""
    e2 = E2
    c0 = 1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256 - 175 * e2**4 / 16384
    c2 = 3.0 / 8 * (e2 + e2**2 / 4 + 15 * e2**3 / 128 - 455 * e2**4 / 4096)
    c4 = 15.0 / 256 * (e2**2 + 3 * e2**3 / 4 - 77 * e2**4 / 128)
    c6 = 35.0 / 3072 * (e2**3 + 41 * e2**4 / 32)
    c8 = -315.0 / 131072 * e2**4
    return A * (c0 * lat - c2 * math.sin(2 * lat) + c4 * math.sin(4 * lat)
                - c6 * math.sin(6 * lat) + c8 * math.sin(8 * lat))


M0 = _meridian_arc(LAT0)


def _tmerc_inverse(x, y):
    """Grid metres -> geodetic radians on GRS80 (Israel 1993 datum)."""
    e2 = E2
    ep2 = e2 / (1 - e2)
    m = M0 + (y - Y0) / K0
    mu = m / (A * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    lat1 = (mu
            + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
            + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
            + (151 * e1**3 / 96) * math.sin(6 * mu)
            + (1097 * e1**4 / 512) * math.sin(8 * mu))
    s, c = math.sin(lat1), math.cos(lat1)
    t = s / c
    c2 = c * c
    cc = t * t
    cn = ep2 * c2
    r1 = A * (1 - e2) / (1 - e2 * s * s) ** 1.5
    n1 = A / math.sqrt(1 - e2 * s * s)
    d = (x - X0) / (n1 * K0)
    lat = lat1 - (n1 * t / r1) * (
        d**2 / 2
        - (5 + 3 * cc + 10 * cn - 4 * cn**2 - 9 * ep2) * d**4 / 24
        + (61 + 90 * cc + 298 * cn + 45 * cc**2 - 252 * ep2 - 3 * cn**2) * d**6 / 720)
    lon = LON0 + (
        d
        - (1 + 2 * cc + cn) * d**3 / 6
        + (5 - 2 * cn + 28 * cc - 3 * cn**2 + 8 * ep2 + 24 * cc**2) * d**5 / 120) / c
    return lat, lon


def _helmert_to_wgs84(lat, lon):
    """3-parameter geocentric translation, iterating back to geodetic."""
    s, c = math.sin(lat), math.cos(lat)
    n = A / math.sqrt(1 - E2 * s * s)
    xg = (n) * c * math.cos(lon)
    yg = (n) * c * math.sin(lon)
    zg = (n * (1 - E2)) * s
    xg += DX
    yg += DY
    zg += DZ
    # WGS84 ellipsoid is GRS80 for our purposes (a and f agree to <0.1 mm)
    p = math.hypot(xg, yg)
    lon2 = math.atan2(yg, xg)
    lat2 = math.atan2(zg, p * (1 - E2))
    for _ in range(5):
        s2 = math.sin(lat2)
        n2 = A / math.sqrt(1 - E2 * s2 * s2)
        h = p / math.cos(lat2) - n2
        lat2 = math.atan2(zg, p * (1 - E2 * n2 / (n2 + h)))
    return lat2, lon2


def itm_to_wgs84(x, y):
    """(easting, northing) in ITM metres -> (lat, lon) in WGS84 degrees."""
    lat, lon = _tmerc_inverse(x, y)
    lat, lon = _helmert_to_wgs84(lat, lon)
    return math.degrees(lat), math.degrees(lon)


if __name__ == "__main__":
    for name, x, y in [
        ("grid origin", X0, Y0),
        ("Jerusalem, Old City", 222300, 631500),
        ("Tel Aviv, Rabin Square", 178370, 664200),
        ("Haifa, Bat Galim", 198000, 747000),
        ("Eilat", 192000, 385500),
        ("Abu Ghosh", 210524, 634814),
    ]:
        lat, lon = itm_to_wgs84(x, y)
        print(f"{name:24s} {lat:.5f}, {lon:.5f}")
