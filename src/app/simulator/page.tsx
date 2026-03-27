// src/app/simulator/page.tsx

"use client"

import { useEffect } from "react"
import { useGame } from "@/hooks/useGame"
import { debugCards } from "@/lib/engine/debugEntine"
import { cards } from "@/lib/data/cards"

export default function SimulatorPage() {
    const { state, currentCard, startGame, chooseOption } = useGame()
    const debug = debugCards(cards, state)



    useEffect(() => {
        startGame()
    }, [])

    if (!currentCard) {
        return <div className="p-4">No hay cartas disponibles</div>
    }

    const firstOption = currentCard.options[0]
    const secondOption = currentCard.options[1]


    return (
        <div className="min-h-screen bg-black text-white p-6 flex flex-col gap-6">

            {/* 📊 Stats */}
            <div className="border p-4 rounded-xl">
                <p>💰 Oro: {state.stats.gold}</p>
                <p>💀 Sospecha: {state.stats.suspicion}</p>
                <p>🧠 Lucidez: {state.stats.lucidity}</p>
            </div>


            <div className="w-full flex justify-center items-center gap-2.5 bg-red-500 p-2.5 y-2.5">
                {/* Primer opcion */}
                <button
                    onClick={() => chooseOption(firstOption)}
                    className="border p-2.5 rounded hover:bg-gray-800 text-left h-[200px] w-[200px] flex items-center justify-center"
                >
                    {firstOption?.text}
                </button>

                {/* 🧾 Card */}
                <div className="border p-4 rounded-xl h-[400px] w-[300px] flex flex-col gap-4">
                    <h2 className="text-xl font-bold">{currentCard.title}</h2>
                    <p className="mt-2 text-gray-300">{currentCard.description}</p>
                </div>

                {/* Segunda opcion */}
                <button
                    onClick={() => chooseOption(secondOption)}
                    className="border p-2.5 rounded hover:bg-gray-800 text-left h-[200px] w-[200px] flex items-center justify-center"
                >
                    {secondOption?.text}
                </button>
            </div>

            {/* 🎯 Opciones
            <div className="flex flex-col gap-2">
                {currentCard.options.map(option => (
                    <button
                        key={option.id}
                        onClick={() => chooseOption(option)}
                        className="border p-2 rounded hover:bg-gray-800 text-left"
                    >
                        {option.text}
                    </button>
                ))}
            </div> */}
            {/* 🎒 Inventario */}

            <div className="border p-4 rounded-xl">
                <p className="mb-2">Inventario:</p>
                <div className="flex gap-2">
                    {state.inventory.map(item => (
                        <span key={item} className="border px-2 py-1 rounded">
                            {item}
                        </span>
                    ))}
                </div>
            </div>

            <div className="border p-4 text-xs mt-4">
                <p className="font-bold mb-2">DEBUG CARTAS</p>

                {debug.map(d => (
                    <div key={d.id} className="mb-2">
                        <p>
                            {d.title} → {d.valid ? "✅" : "❌"}
                        </p>

                        {d.evaluations.map((ev, i) => (
                            <p key={i}>
                                - {ev.type} ({ev.key}) = {String(ev.value)} → {String(ev.result)}
                            </p>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}