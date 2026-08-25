<?php

return [
    /*
    | Délai pendant lequel une vente terminée peut être annulée (minutes).
    */
    'delai_annulation_vente_minutes' => (int) env('SGCI_DELAI_ANNULATION_VENTE', 5),

    /*
    | Taux de TVA par défaut (fraction, ex: 0.18 = 18%).
    */
    'taux_tva' => (float) env('SGCI_TAUX_TVA', 0.18),

    /*
    | Durée de validité des tokens Sanctum (minutes).
    */
    'token_ttl_minutes' => (int) env('SGCI_TOKEN_TTL_MINUTES', 120),
];
