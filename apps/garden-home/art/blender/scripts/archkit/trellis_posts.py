"""Where the grape trellis stands on its posts (villa v2 spec §5.2). Pure Python: vines.py builds the posts from this
list and the house layout (system Python) puts a planter at the foot of every one, so both read the same function.
"""

POST_SPAN = 3.5  # longest stretch between posts along a long side


def trellis_posts(mn, mx):
    """Post centres (x, y) of a trellis over the rectangle mn..mx: the four corners first, then pairs of posts that
    divide the long sides into runs of at most about POST_SPAN."""
    (x0, y0), (x1, y1) = mn, mx
    along_x = x1 - x0 >= y1 - y0
    length = x1 - x0 if along_x else y1 - y0
    runs = max(1, round(length / POST_SPAN))
    posts = [(x, y) for x in (x0, x1) for y in (y0, y1)]
    for i in range(1, runs):
        t = i * length / runs
        posts += [(x0 + t, y0), (x0 + t, y1)] if along_x else [(x0, y0 + t), (x1, y0 + t)]
    return posts
