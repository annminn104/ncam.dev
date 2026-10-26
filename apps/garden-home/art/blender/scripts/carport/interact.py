"""What a click toggles at the carport and what it does to the dog (art/README.md, Carport and dog). Pure
Python.

The carport's downlights are the group lights:carport "Carport lights": their object and the carport itself (its roof,
posts and wall), since the downlights hang under the roof's beams out of sight from above, so a click on the roof
switches them. Each car's head and tail lights are a group of their own, lights:car_pickup "Pickup truck lights" and
lights:car_super "Supercar lights", on the car's body and on its lights' object: a click on the car switches its lights,
which glow softly at night on auto like the garden's lights (the website's light groups, src/interact). The Akita is
the group dog "Akita pup", which a click does not toggle: it plays the dog's happy clip once (act_dog_happy, its
`clip`), on top of its breathing and its slow wag.
"""
from houses.interact import GROUP_RE  # noqa: F401  (the website reads carport, garden and house ids alike)

CARPORT, CARPORT_LABEL = "lights:carport", "Carport lights"
CAR_LABELS = {"lights:car_pickup": "Pickup truck lights", "lights:car_super": "Supercar lights"}
DOG, DOG_LABEL = "dog", "Akita pup"


def tags(layout):
    """{object name: custom properties} for every interactive object of a carport or a kennel layout: "interact" and
    "label" on the carport and its downlights, and on the body and the lights of every car of CARS; on the Akita (the
    body its head and tail hang from) "clip" as well, the clip a click plays."""
    found = {}
    if hasattr(layout, "CARS"):
        found.update({name: {"interact": CARPORT, "label": CARPORT_LABEL} for name in (layout.STILL, layout.LIGHTS)})
        for car in layout.CARS:
            for name in (car["name"], car["lights"]):
                found[name] = {"interact": car["group"], "label": CAR_LABELS[car["group"]]}
    if hasattr(layout, "DOG"):
        found[layout.DOG["name"]] = {"interact": DOG, "label": DOG_LABEL, "clip": layout.HAPPY["clip"]}
    return found
