from __future__ import annotations

import array
from pathlib import Path
import wave


VOICE_ROWS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("00-KANA POP.wav", ("a", "i", "u", "e", "o")),
    ("01-KANA POP.wav", ("ka", "ki", "ku", "ke", "ko")),
    ("02-KANA POP.wav", ("sa", "shi", "su", "se", "so")),
    ("03-KANA POP.wav", ("ta", "chi", "tsu", "te", "to")),
    ("04-KANA POP.wav", ("na", "ni", "nu", "ne", "no")),
    ("05-KANA POP.wav", ("ha", "hi", "fu", "he", "ho")),
    ("06-KANA POP.wav", ("ma", "mi", "mu", "me", "mo")),
    ("07-KANA POP.wav", ("ya", "yu", "yo")),
    ("08-KANA POP.wav", ("ra", "ri", "ru", "re", "ro")),
    ("09-KANA POP.wav", ("wa", "wo", "n")),
    ("10-KANA POP.wav", ("ga", "gi", "gu", "ge", "go")),
    ("11-KANA POP.wav", ("za", "ji", "zu", "ze", "zo")),
    ("12-KANA POP.wav", ("da", "dji", "dzu", "de", "do")),
    ("13-KANA POP.wav", ("ba", "bi", "bu", "be", "bo")),
    ("14-KANA POP.wav", ("pa", "pi", "pu", "pe", "po")),
    ("15-KANA POP.wav", ("kya", "kyu", "kyo")),
    ("16-KANA POP.wav", ("sha", "shu", "sho")),
    ("17-KANA POP.wav", ("cha", "chu", "cho")),
    ("18-KANA POP.wav", ("nya", "nyu", "nyo")),
    ("19-KANA POP.wav", ("hya", "hyu", "hyo")),
    ("20-KANA POP.wav", ("mya", "myu", "myo")),
    ("21-KANA POP.wav", ("rya", "ryu", "ryo")),
    ("22-KANA POP.wav", ("gya", "gyu", "gyo")),
    ("23-KANA POP.wav", ("ja", "ju", "jo")),
    ("24-KANA POP.wav", ("dya", "dyu", "dyo")),
    ("25-KANA POP.wav", ("bya", "byu", "byo")),
    ("26-KANA POP.wav", ("pya", "pyu", "pyo")),
)


def moving_average(values: list[int], radius: int) -> list[float]:
    total = 0
    result: list[float] = []
    for index, value in enumerate(values):
        total += value
        if index > radius * 2:
            total -= values[index - radius * 2 - 1]
        result.append(total / min(index + 1, radius * 2 + 1))
    return result


def split_points(samples: array.array[int], count: int) -> list[int]:
    energy = moving_average([abs(value) for value in samples], radius=240)
    peak = max(energy)
    threshold = peak * 0.025
    first = next(index for index, value in enumerate(energy) if value >= threshold)
    last = len(energy) - next(index for index, value in enumerate(reversed(energy)) if value >= threshold)
    boundaries = [max(0, first - 960)]
    for index in range(1, count):
        ideal = first + (last - first) * index // count
        radius = max(960, (last - first) // count // 3)
        start = max(boundaries[-1] + 960, ideal - radius)
        end = min(last - (count - index) * 960, ideal + radius)
        boundary = min(range(start, end), key=energy.__getitem__)
        boundaries.append(boundary)
    boundaries.append(min(len(samples), last + 960))
    return boundaries


def write_clip(source: wave.Wave_read, samples: array.array[int], start: int, end: int, output: Path) -> None:
    with wave.open(str(output), "wb") as target:
        target.setparams(source.getparams())
        target.writeframes(samples[start:end].tobytes())


def main() -> None:
    voice_dir = Path(__file__).resolve().parents[1] / "public" / "voice"
    output_dir = voice_dir / "clips"
    output_dir.mkdir(exist_ok=True)

    for filename, romajis in VOICE_ROWS:
        with wave.open(str(voice_dir / filename), "rb") as source:
            if source.getsampwidth() != 2 or source.getnchannels() != 1:
                raise ValueError(f"Unsupported WAV format: {filename}")
            samples = array.array("h")
            samples.frombytes(source.readframes(source.getnframes()))
            boundaries = split_points(samples, len(romajis))
            for index, romaji in enumerate(romajis):
                write_clip(source, samples, boundaries[index], boundaries[index + 1], output_dir / f"{romaji}.wav")


if __name__ == "__main__":
    main()
