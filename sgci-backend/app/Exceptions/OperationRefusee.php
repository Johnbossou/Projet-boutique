<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Refus métier volontaire d'une opération de caisse.
 *
 * Elle permet de distinguer un refus attendu (stock insuffisant, produit
 * hors tenant) d'une véritable panne. Les captures génériques de
 * RuntimeException attrapaient aussi les PDOException (QueryException en
 * hérite) et renvoyaient au client le SQL complet, les noms de tables et
 * de colonnes.
 *
 * render() est implémenté pour que le refus remonte toujours en 4xx. Sans lui,
 * une OperationRefusee levée à l'intérieur d'une transaction mais non rattrapée
 * par le contrôleur remontait en 500 : le client croyait à une panne serveur
 * alors que le refus était attendu.
 */
class OperationRefusee extends RuntimeException
{
    protected int $statutHttp = 422;

    /**
     * @param  int|null  $statutHttp  statut HTTP souhaité. Le second argument de
     *                                RuntimeException est le code, pas un statut ;
     *                                les codes hors plage HTTP sont donc ignorés.
     */
    public function __construct(string $message = '', ?int $statutHttp = null)
    {
        // Le code est conservé pour les appelants existants qui lisaient
        // getCode() ; le statut HTTP explicite reste la source de vérité.
        parent::__construct($message, $statutHttp ?? 0);

        if ($statutHttp !== null && $statutHttp >= 400 && $statutHttp <= 599) {
            $this->statutHttp = $statutHttp;
        }
    }

    public function statutHttp(): int
    {
        return $this->statutHttp;
    }

    public function render($request)
    {
        return response()->json(
            ['message' => $this->getMessage()],
            $this->statutHttp
        );
    }
}
