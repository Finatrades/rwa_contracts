// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title JurisdictionLib
 * @notice Library for managing allowed jurisdictions for Asian and African regions
 */
library JurisdictionLib {
    /**
     * @dev Returns array of Asian jurisdiction codes
     */
    function getAsianJurisdictions() internal pure returns (string[] memory) {
        string[] memory jurisdictions = new string[](33);
        jurisdictions[0] = "AF"; // Afghanistan
        jurisdictions[1] = "AM"; // Armenia
        jurisdictions[2] = "AZ"; // Azerbaijan
        jurisdictions[3] = "BD"; // Bangladesh
        jurisdictions[4] = "BT"; // Bhutan
        jurisdictions[5] = "BN"; // Brunei
        jurisdictions[6] = "KH"; // Cambodia
        jurisdictions[7] = "CN"; // China
        jurisdictions[8] = "GE"; // Georgia
        jurisdictions[9] = "IN"; // India
        jurisdictions[10] = "ID"; // Indonesia
        jurisdictions[11] = "JP"; // Japan
        jurisdictions[12] = "KZ"; // Kazakhstan
        jurisdictions[13] = "KG"; // Kyrgyzstan
        jurisdictions[14] = "LA"; // Laos
        jurisdictions[15] = "MY"; // Malaysia
        jurisdictions[16] = "MV"; // Maldives
        jurisdictions[17] = "MN"; // Mongolia
        jurisdictions[18] = "MM"; // Myanmar
        jurisdictions[19] = "NP"; // Nepal
        jurisdictions[20] = "KP"; // North Korea
        jurisdictions[21] = "PK"; // Pakistan
        jurisdictions[22] = "PH"; // Philippines
        jurisdictions[23] = "SG"; // Singapore
        jurisdictions[24] = "KR"; // South Korea
        jurisdictions[25] = "LK"; // Sri Lanka
        jurisdictions[26] = "TW"; // Taiwan
        jurisdictions[27] = "TJ"; // Tajikistan
        jurisdictions[28] = "TH"; // Thailand
        jurisdictions[29] = "TL"; // Timor-Leste
        jurisdictions[30] = "TM"; // Turkmenistan
        jurisdictions[31] = "UZ"; // Uzbekistan
        jurisdictions[32] = "VN"; // Vietnam
        return jurisdictions;
    }

    /**
     * @dev Returns array of African jurisdiction codes (part 1)
     */
    function getAfricanJurisdictions1() internal pure returns (string[] memory) {
        string[] memory jurisdictions = new string[](27);
        jurisdictions[0] = "DZ"; // Algeria
        jurisdictions[1] = "AO"; // Angola
        jurisdictions[2] = "BJ"; // Benin
        jurisdictions[3] = "BW"; // Botswana
        jurisdictions[4] = "BF"; // Burkina Faso
        jurisdictions[5] = "BI"; // Burundi
        jurisdictions[6] = "CM"; // Cameroon
        jurisdictions[7] = "CV"; // Cape Verde
        jurisdictions[8] = "CF"; // Central African Republic
        jurisdictions[9] = "TD"; // Chad
        jurisdictions[10] = "KM"; // Comoros
        jurisdictions[11] = "CD"; // Democratic Republic of the Congo
        jurisdictions[12] = "CG"; // Republic of the Congo
        jurisdictions[13] = "CI"; // Côte d'Ivoire
        jurisdictions[14] = "DJ"; // Djibouti
        jurisdictions[15] = "EG"; // Egypt
        jurisdictions[16] = "GQ"; // Equatorial Guinea
        jurisdictions[17] = "ER"; // Eritrea
        jurisdictions[18] = "SZ"; // Eswatini
        jurisdictions[19] = "ET"; // Ethiopia
        jurisdictions[20] = "GA"; // Gabon
        jurisdictions[21] = "GM"; // Gambia
        jurisdictions[22] = "GH"; // Ghana
        jurisdictions[23] = "GN"; // Guinea
        jurisdictions[24] = "GW"; // Guinea-Bissau
        jurisdictions[25] = "KE"; // Kenya
        jurisdictions[26] = "LS"; // Lesotho
        return jurisdictions;
    }

    /**
     * @dev Returns array of African jurisdiction codes (part 2)
     */
    function getAfricanJurisdictions2() internal pure returns (string[] memory) {
        string[] memory jurisdictions = new string[](27);
        jurisdictions[0] = "LR"; // Liberia
        jurisdictions[1] = "LY"; // Libya
        jurisdictions[2] = "MG"; // Madagascar
        jurisdictions[3] = "MW"; // Malawi
        jurisdictions[4] = "ML"; // Mali
        jurisdictions[5] = "MR"; // Mauritania
        jurisdictions[6] = "MU"; // Mauritius
        jurisdictions[7] = "MA"; // Morocco
        jurisdictions[8] = "MZ"; // Mozambique
        jurisdictions[9] = "NA"; // Namibia
        jurisdictions[10] = "NE"; // Niger
        jurisdictions[11] = "NG"; // Nigeria
        jurisdictions[12] = "RW"; // Rwanda
        jurisdictions[13] = "ST"; // São Tomé and Príncipe
        jurisdictions[14] = "SN"; // Senegal
        jurisdictions[15] = "SC"; // Seychelles
        jurisdictions[16] = "SL"; // Sierra Leone
        jurisdictions[17] = "SO"; // Somalia
        jurisdictions[18] = "ZA"; // South Africa
        jurisdictions[19] = "SS"; // South Sudan
        jurisdictions[20] = "SD"; // Sudan
        jurisdictions[21] = "TZ"; // Tanzania
        jurisdictions[22] = "TG"; // Togo
        jurisdictions[23] = "TN"; // Tunisia
        jurisdictions[24] = "UG"; // Uganda
        jurisdictions[25] = "ZM"; // Zambia
        jurisdictions[26] = "ZW"; // Zimbabwe
        return jurisdictions;
    }
}